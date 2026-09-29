-- ============================================================
-- Assinatura recorrente de plano via Asaas — mesma conta/API já usada
-- pra créditos avulsos (0017), agora também pra cobrança mensal
-- recorrente. v1 deliberadamente simples: cada plano só concede créditos
-- mensais (`plans.creditos_mensais`, via o mesmo `increment_creditos` de
-- 0017) quando uma cobrança da assinatura é confirmada — NÃO libera
-- automaticamente os outros flags de feature (disparo_habilitado,
-- linkedin_visible etc.); esses continuam admin-editáveis por usuário,
-- como já eram. Bundle de feature por plano é uma decisão de produto
-- maior (o que exatamente cada tier libera) que fica pra uma rodada
-- futura, quando a landing page de vendas também entrar em cena.
--
-- Ciclo: `criarAssinatura()` cria a assinatura no Asaas com
-- billingType UNDEFINED (mesma escolha de 0017 — pagador decide PIX/
-- boleto/cartão na fatura) e cycle MONTHLY. O Asaas gera uma cobrança
-- (payment) nova a cada mês, com o campo `subscription` apontando de
-- volta pra assinatura — é assim que o webhook diferencia uma renovação
-- de uma compra avulsa (ver processarPagamentoAssinatura em
-- subscriptions-db.ts). Diferente de credit_purchases (onde SEMPRE
-- criamos a linha antes de cobrar), aqui as cobranças de renovação são
-- criadas pelo próprio Asaas de forma assíncrona — só sabemos que elas
-- existem quando o webhook avisa, por isso `subscription_payments` é
-- alimentada por INSERT no webhook, não populada antecipadamente.
-- ============================================================

create table if not exists plans (
    id                uuid primary key default gen_random_uuid(),
    nome              text not null unique,
    preco_centavos    integer not null check (preco_centavos > 0),
    creditos_mensais  integer not null default 0,
    ordem             integer not null default 0,
    ativo             boolean not null default true,
    descricao         text,
    criado_em         timestamptz not null default now()
);

alter table plans enable row level security;

drop policy if exists "leitura_plans" on plans;
create policy "leitura_plans" on plans
    for select using (auth.role() = 'authenticated');

drop policy if exists "admin_escreve_plans" on plans;
create policy "admin_escreve_plans" on plans
    for all using (is_admin(auth.uid()));

insert into plans (nome, preco_centavos, creditos_mensais, ordem, descricao) values
    ('Starter',  9900,  2000,  1, 'Pra quem está começando a prospecção ativa.'),
    ('Pro',      24900, 6000,  2, 'Mais volume e canais de disparo liberados.'),
    ('Business', 49900, 15000, 3, 'Times que precisam de escala e todos os canais.')
on conflict (nome) do nothing;

alter table profiles add column if not exists plano_id uuid references plans(id) on delete set null;
alter table profiles add column if not exists asaas_subscription_id text;
-- pendente: assinatura criada no Asaas, aguardando confirmação da 1ª cobrança.
-- ativa: última cobrança confirmada. inadimplente: cobrança do ciclo atual falhou/venceu.
-- cancelada: usuário cancelou (ou nunca teve assinatura, junto com o default).
alter table profiles add column if not exists assinatura_status text not null default 'sem_assinatura'
    check (assinatura_status in ('sem_assinatura', 'pendente', 'ativa', 'inadimplente', 'cancelada'));

create table if not exists subscription_payments (
    id                     uuid primary key default gen_random_uuid(),
    user_id                uuid not null references auth.users(id) on delete cascade,
    plan_id                uuid references plans(id) on delete set null,
    asaas_subscription_id  text not null,
    asaas_payment_id       text unique,
    preco_centavos         integer not null,
    status                 text not null default 'pago' check (status in ('pago', 'falhou')),
    criado_em              timestamptz not null default now()
);

create index if not exists idx_subscription_payments_user on subscription_payments(user_id);
create index if not exists idx_subscription_payments_asaas_payment on subscription_payments(asaas_payment_id);

alter table subscription_payments enable row level security;

drop policy if exists "own_or_admin_select_subscription_payments" on subscription_payments;
create policy "own_or_admin_select_subscription_payments" on subscription_payments
    for select using (user_id = auth.uid() or is_admin(auth.uid()));

-- Sem policy de INSERT/UPDATE pro usuário comum — só o webhook (cliente
-- admin) grava aqui, mesma lógica de segurança de credit_purchases em 0017.
