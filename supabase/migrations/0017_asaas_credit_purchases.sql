-- ============================================================
-- Compra de créditos avulsos via Asaas (asaas.com) — gateway escolhido
-- pelo próprio usuário (conta já existente lá, PIX/boleto/cartão nativos,
-- taxas boas pro público brasileiro). Fluxo: usuário escolhe um pacote →
-- cria-se (ou reusa) um cliente Asaas → cria-se uma cobrança
-- (billingType UNDEFINED, o pagador escolhe o método na fatura hospedada
-- do próprio Asaas) → o usuário é redirecionado pra lá → um webhook nos
-- avisa quando o pagamento é confirmado, e só então os créditos entram.
--
-- `credit_purchases` nunca é atualizada pelo cliente autenticado (sem
-- policy de UPDATE pra ele) — só o webhook, via service-role, pode marcar
-- uma compra como paga. Isso evita que alguém chame a API e se
-- autoconceda créditos sem pagar de verdade.
-- ============================================================

alter table profiles add column if not exists asaas_customer_id text;
-- CPF/CNPJ do pagador — o Asaas exige isso pra criar um cliente. Coletado
-- na primeira compra e reaproveitado nas seguintes (mesmo campo serve pra
-- pessoa física ou jurídica, sem distinção de UI).
alter table profiles add column if not exists cpf_cnpj text;

create table if not exists credit_packages (
    id                    uuid primary key default gen_random_uuid(),
    nome                  text not null unique,
    quantidade_creditos   integer not null check (quantidade_creditos > 0),
    preco_centavos        integer not null check (preco_centavos > 0),
    ordem                 integer not null default 0,
    ativo                 boolean not null default true,
    criado_em             timestamptz not null default now()
);

alter table credit_packages enable row level security;

drop policy if exists "leitura_credit_packages" on credit_packages;
create policy "leitura_credit_packages" on credit_packages
    for select using (auth.role() = 'authenticated');

drop policy if exists "admin_escreve_credit_packages" on credit_packages;
create policy "admin_escreve_credit_packages" on credit_packages
    for all using (is_admin(auth.uid()));

-- Pacotes iniciais — preço de referência, ajustável pelo admin sem
-- deploy (mesma filosofia de credit_costs). 1 crédito ≈ R$0,005 de custo
-- real de fornecedor; a margem aqui é intencional (ver README).
insert into credit_packages (nome, quantidade_creditos, preco_centavos, ordem) values
    ('Starter',   1000, 2990,  1),
    ('Popular',   3000, 7990,  2),
    ('Avançado',  8000, 17990, 3)
on conflict (nome) do nothing;

create table if not exists credit_purchases (
    id                    uuid primary key default gen_random_uuid(),
    user_id               uuid not null references auth.users(id) on delete cascade,
    package_id            uuid references credit_packages(id) on delete set null,
    quantidade_creditos   integer not null,
    preco_centavos        integer not null,
    asaas_customer_id     text,
    asaas_payment_id      text unique,
    status                text not null default 'pendente' check (status in ('pendente', 'pago', 'falhou', 'cancelado')),
    invoice_url           text,
    criado_em             timestamptz not null default now(),
    pago_em               timestamptz
);

create index if not exists idx_credit_purchases_user on credit_purchases(user_id);
create index if not exists idx_credit_purchases_asaas_payment on credit_purchases(asaas_payment_id);

alter table credit_purchases enable row level security;

drop policy if exists "own_or_admin_select_credit_purchases" on credit_purchases;
create policy "own_or_admin_select_credit_purchases" on credit_purchases
    for select using (user_id = auth.uid() or is_admin(auth.uid()));

-- Só INSERT pro dono (a rota de compra usa o cliente autenticado do
-- usuário) — sem policy de UPDATE pra ninguém além de service-role
-- (webhook), de propósito.
drop policy if exists "own_insert_credit_purchases" on credit_purchases;
create policy "own_insert_credit_purchases" on credit_purchases
    for insert with check (user_id = auth.uid());

-- RPC de crédito atômico do pool único — irmã de decrement_creditos
-- (0013_unified_credits.sql), mesma proteção contra concorrência.
create or replace function increment_creditos(
    p_user_id uuid,
    p_delta   integer
) returns void
language plpgsql security definer as $$
begin
    if p_delta <= 0 then
        return;
    end if;
    update profiles set creditos = creditos + p_delta where id = p_user_id;
end;
$$;
