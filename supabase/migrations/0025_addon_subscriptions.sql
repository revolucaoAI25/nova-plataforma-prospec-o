-- ============================================================
-- Add-ons pagos avulsos por assinatura recorrente própria — pedido
-- explícito do usuário: em vez de só liberar um recurso premium (hoje,
-- disparo por LinkedIn) exclusivamente em planos mais caros, deixar
-- qualquer usuário assinar esse recurso separadamente, como uma
-- assinatura recorrente própria em cima do plano base.
--
-- Por que uma tabela nova em vez de reaproveitar `plans`/`profiles`:
-- `profiles` só guarda UM `asaas_subscription_id` (a assinatura do
-- plano) — um usuário no Starter que assina o add-on de LinkedIn passa a
-- ter DUAS assinaturas Asaas ativas ao mesmo tempo (plano + add-on), then
-- não cabe nas colunas singulares que já existem. `user_addon_subscriptions`
-- é o equivalente de `profiles.plano_id`/`asaas_subscription_id`/
-- `assinatura_status`, mas em linhas (1 por add-on assinado) em vez de
-- colunas — permite N add-ons simultâneos por usuário no futuro, embora
-- só exista 1 add-on nesta v1.
--
-- v1 cobre só o add-on de disparo por LinkedIn (`linkedin_disparo_habilitado`)
-- — é o único dos "extras" da tabela de preços que já tem um flag binário
-- dedicado e nenhuma dependência de provisionamento manual. O canal
-- oficial de WhatsApp (Datafy) fica de fora de propósito: já depende de
-- aprovação manual do admin (`/disparo/solicitar-oficial`, credenciais
-- reais provisionadas à mão), então "cobrar por ele" nesta v1 é uma
-- decisão na hora de aprovar a solicitação, não um checkout self-service.
-- ============================================================

create table if not exists addons (
    id                uuid primary key default gen_random_uuid(),
    nome              text not null unique,
    preco_centavos    integer not null check (preco_centavos > 0),
    feature_flag      text not null check (feature_flag in (
        'disparo_habilitado', 'instagram_visible', 'linkedin_visible',
        'enriquecimento_ia_habilitado', 'bigdatacorp_enrichment_habilitado',
        'email_disparo_habilitado', 'linkedin_disparo_habilitado'
    )),
    ordem             integer not null default 0,
    ativo             boolean not null default true,
    descricao         text,
    criado_em         timestamptz not null default now()
);

alter table addons enable row level security;

drop policy if exists "leitura_addons" on addons;
create policy "leitura_addons" on addons
    for select using (auth.role() = 'authenticated');

drop policy if exists "admin_escreve_addons" on addons;
create policy "admin_escreve_addons" on addons
    for all using (is_admin(auth.uid()));

insert into addons (nome, preco_centavos, feature_flag, ordem, descricao) values
    ('Disparo por LinkedIn', 17500, 'linkedin_disparo_habilitado', 1,
     'Módulo de pedidos de conexão e mensagens por LinkedIn (Unipile) — já incluso no plano Business.')
on conflict (nome) do nothing;

create table if not exists user_addon_subscriptions (
    id                     uuid primary key default gen_random_uuid(),
    user_id                uuid not null references auth.users(id) on delete cascade,
    addon_id               uuid not null references addons(id) on delete cascade,
    asaas_subscription_id  text,
    -- mesmos 5 estados de profiles.assinatura_status, mesmo significado.
    status                 text not null default 'pendente'
        check (status in ('pendente', 'ativa', 'inadimplente', 'cancelada')),
    criado_em              timestamptz not null default now(),
    atualizado_em          timestamptz not null default now(),
    unique (user_id, addon_id)
);

create index if not exists idx_user_addon_subscriptions_subscription
    on user_addon_subscriptions(asaas_subscription_id);

alter table user_addon_subscriptions enable row level security;

drop policy if exists "own_or_admin_select_user_addon_subscriptions" on user_addon_subscriptions;
create policy "own_or_admin_select_user_addon_subscriptions" on user_addon_subscriptions
    for select using (user_id = auth.uid() or is_admin(auth.uid()));

-- Sem policy de insert/update pro usuário comum — só as rotas de servidor
-- (cliente admin) escrevem aqui, mesmo padrão de subscription_payments.

create table if not exists addon_payments (
    id                     uuid primary key default gen_random_uuid(),
    user_id                uuid not null references auth.users(id) on delete cascade,
    addon_id               uuid references addons(id) on delete set null,
    asaas_subscription_id  text not null,
    asaas_payment_id       text unique,
    preco_centavos         integer not null,
    status                 text not null default 'pago' check (status in ('pago', 'falhou')),
    criado_em              timestamptz not null default now()
);

create index if not exists idx_addon_payments_user on addon_payments(user_id);
create index if not exists idx_addon_payments_asaas_payment on addon_payments(asaas_payment_id);

alter table addon_payments enable row level security;

drop policy if exists "own_or_admin_select_addon_payments" on addon_payments;
create policy "own_or_admin_select_addon_payments" on addon_payments
    for select using (user_id = auth.uid() or is_admin(auth.uid()));
