-- ============================================================
-- Disparo por LinkedIn — Unipile (pedido de conexão + mensagem).
-- Espelha o disparo WhatsApp/e-mail o mais fielmente possível, com as
-- diferenças que o canal exige:
--   - `linkedin_accounts` é conceitualmente como `whatsapp_instances`
--     (conta real logada, com estado de conexão/reconexão), não como
--     `email_senders` (só metadados) — aqui existe de verdade uma sessão
--     por trás, gerenciada pela Unipile.
--   - Limites diários SEPARADOS pra convite e mensagem (ritmos de risco
--     diferentes no LinkedIn) e pacing/estado de liberação também
--     separados por tipo de ação.
--   - `linkedin_cadence_steps.tipo` distingue etapa de convite (com nota
--     opcional) de etapa de mensagem (com corpo) — não existe essa
--     distinção nos outros dois canais.
--   - `linkedin_targets.status` ganha o estado extra `aguardando_aceite`:
--     depois de um convite enviado, o alvo fica preso aí até um evento
--     externo (webhook de nova relação, ou o poll de reforço) confirmar
--     que foi aceito — só então a próxima etapa (mensagem) pode disparar.
--     No LinkedIn só dá pra iniciar conversa com quem já é 1º grau.
--   - `provider_id` (identificador que a Unipile exige pras chamadas) e
--     `chat_id` (pra não duplicar conversa numa cadência de várias
--     mensagens) ficam cacheados no próprio alvo, resolvidos sob demanda
--     pelo worker.
--   - `claim_linkedin_target` reivindica 1 alvo por vez (como
--     claim_dispatch_target do WhatsApp), não em lote como o e-mail —
--     o volume seguro por dia aqui é baixo e o espaçamento entre ações
--     precisa ser de minutos, não segundos.
-- ============================================================

alter table profiles add column if not exists linkedin_disparo_habilitado boolean not null default false;

create table if not exists linkedin_accounts (
    id                          uuid primary key default gen_random_uuid(),
    user_id                     uuid not null references auth.users(id) on delete cascade,
    nome                        text not null,
    unipile_account_id          text,
    status                      text not null default 'conectando' check (status in ('conectando', 'conectado', 'desconectado', 'requer_reconexao')),
    perfil_nome                 text,
    limite_diario_convites      integer not null default 15,
    limite_diario_mensagens     integer not null default 30,
    ultimo_convite_em           timestamptz,
    proximo_convite_liberado_em timestamptz,
    ultima_mensagem_em          timestamptz,
    proximo_mensagem_liberado_em timestamptz,
    criado_em                   timestamptz not null default now()
);

create table if not exists linkedin_campaigns (
    id                uuid primary key default gen_random_uuid(),
    user_id           uuid not null references auth.users(id) on delete cascade,
    nome              text not null,
    account_id        uuid references linkedin_accounts(id),
    status            text not null default 'rascunho' check (status in ('rascunho', 'ativa', 'pausada', 'concluida')),
    tipo_origem       text not null check (tipo_origem in ('busca_existente', 'upload', 'manual', 'auto_trigger', 'sheet_watch')),
    origem_search_id  uuid references searches(id),
    filtro_nicho      text,
    filtro_subnicho   text,
    filtro_uf         text,
    ultimo_trigger_em timestamptz,
    -- Espaçamento bem maior que WhatsApp/e-mail de propósito — automação
    -- "rápida" no LinkedIn é o padrão que mais chama atenção de detecção
    -- de bot. Default 3-10 minutos entre ações.
    intervalo_min_seg integer not null default 180,
    intervalo_max_seg integer not null default 600,
    criado_em         timestamptz not null default now()
);

create table if not exists linkedin_templates (
    id         uuid primary key default gen_random_uuid(),
    user_id    uuid not null references auth.users(id) on delete cascade,
    nome       text not null,
    corpo      text not null,
    criado_em  timestamptz not null default now()
);

create table if not exists linkedin_cadence_steps (
    id           uuid primary key default gen_random_uuid(),
    campaign_id  uuid not null references linkedin_campaigns(id) on delete cascade,
    ordem        integer not null,
    atraso_horas numeric not null default 0,
    tipo         text not null check (tipo in ('convite', 'mensagem')),
    nota         text,
    corpo        text,
    template_id  uuid references linkedin_templates(id),
    criado_em    timestamptz not null default now()
);

create table if not exists linkedin_targets (
    id                uuid primary key default gen_random_uuid(),
    campaign_id       uuid not null references linkedin_campaigns(id) on delete cascade,
    nome              text,
    linkedin_url      text not null,
    provider_id       text,
    chat_id           text,
    lead_snapshot     jsonb,
    status            text not null default 'pendente' check (status in ('pendente', 'enviando', 'aguardando_aceite', 'enviado', 'concluido', 'falhou', 'removido')),
    current_step_id   uuid references linkedin_cadence_steps(id),
    proxima_etapa_em  timestamptz not null default now(),
    reservado_em      timestamptz,
    criado_em         timestamptz not null default now(),
    atualizado_em     timestamptz not null default now(),
    unique (campaign_id, linkedin_url)
);
create index if not exists idx_linkedin_targets_scan on linkedin_targets(campaign_id, status, proxima_etapa_em);
create index if not exists idx_linkedin_targets_url   on linkedin_targets(linkedin_url);
create index if not exists idx_linkedin_targets_provider on linkedin_targets(provider_id) where provider_id is not null;

create table if not exists linkedin_messages_log (
    id            uuid primary key default gen_random_uuid(),
    target_id     uuid not null references linkedin_targets(id) on delete cascade,
    campaign_id   uuid not null references linkedin_campaigns(id) on delete cascade,
    step_id       uuid references linkedin_cadence_steps(id),
    enviado_em    timestamptz not null default now(),
    status        text not null check (status in ('sucesso', 'erro')),
    tipo_acao     text not null check (tipo_acao in ('convite', 'mensagem')),
    provider_ref  text,
    erro_msg      text,
    corpo_enviado text
);

create table if not exists linkedin_sheet_watchers (
    id                       uuid primary key default gen_random_uuid(),
    campaign_id              uuid not null references linkedin_campaigns(id) on delete cascade,
    sheet_id                 text not null,
    aba_nome                 text not null,
    coluna_url               text not null,
    coluna_nome              text,
    ultima_linha_processada  integer not null default 0,
    criado_em                timestamptz not null default now()
);

create table if not exists linkedin_opt_outs (
    linkedin_url  text not null,
    user_id       uuid not null references auth.users(id) on delete cascade,
    criado_em     timestamptz not null default now(),
    motivo        text,
    primary key (linkedin_url, user_id)
);

-- Reivindicação atômica de 1 alvo pronto pra envio pra essa conta — mesmo
-- padrão de claim_dispatch_target (WhatsApp), não do claim em lote do
-- e-mail: aqui o volume seguro por dia é baixo, não faz sentido reivindicar
-- vários de uma vez.
create or replace function claim_linkedin_target(p_account_id uuid)
returns setof linkedin_targets as $$
    update linkedin_targets
    set status = 'enviando', reservado_em = now()
    where id = (
        select lt.id from linkedin_targets lt
        join linkedin_campaigns lc on lc.id = lt.campaign_id
        where lc.account_id = p_account_id
          and lc.status = 'ativa'
          and lt.status = 'pendente'
          and lt.proxima_etapa_em <= now()
        order by lt.proxima_etapa_em
        limit 1
        for update of lt skip locked
    )
    returning *;
$$ language sql volatile;

-- ── RLS: dono da linha ou admin (is_admin(), padrão desde 0007) ────────
alter table linkedin_accounts       enable row level security;
alter table linkedin_campaigns      enable row level security;
alter table linkedin_templates      enable row level security;
alter table linkedin_cadence_steps  enable row level security;
alter table linkedin_targets        enable row level security;
alter table linkedin_messages_log   enable row level security;
alter table linkedin_sheet_watchers enable row level security;
alter table linkedin_opt_outs       enable row level security;

drop policy if exists "own_or_admin_linkedin_accounts" on linkedin_accounts;
create policy "own_or_admin_linkedin_accounts" on linkedin_accounts
    for all using (user_id = auth.uid() or is_admin(auth.uid()));

drop policy if exists "own_or_admin_linkedin_campaigns" on linkedin_campaigns;
create policy "own_or_admin_linkedin_campaigns" on linkedin_campaigns
    for all using (user_id = auth.uid() or is_admin(auth.uid()));

drop policy if exists "own_or_admin_linkedin_templates" on linkedin_templates;
create policy "own_or_admin_linkedin_templates" on linkedin_templates
    for all using (user_id = auth.uid() or is_admin(auth.uid()));

drop policy if exists "own_or_admin_linkedin_cadence_steps" on linkedin_cadence_steps;
create policy "own_or_admin_linkedin_cadence_steps" on linkedin_cadence_steps
    for all using (
        exists (select 1 from linkedin_campaigns lc where lc.id = campaign_id and lc.user_id = auth.uid())
        or is_admin(auth.uid())
    );

drop policy if exists "own_or_admin_linkedin_targets" on linkedin_targets;
create policy "own_or_admin_linkedin_targets" on linkedin_targets
    for all using (
        exists (select 1 from linkedin_campaigns lc where lc.id = campaign_id and lc.user_id = auth.uid())
        or is_admin(auth.uid())
    );

drop policy if exists "own_or_admin_linkedin_messages_log" on linkedin_messages_log;
create policy "own_or_admin_linkedin_messages_log" on linkedin_messages_log
    for all using (
        exists (select 1 from linkedin_campaigns lc where lc.id = campaign_id and lc.user_id = auth.uid())
        or is_admin(auth.uid())
    );

drop policy if exists "own_or_admin_linkedin_sheet_watchers" on linkedin_sheet_watchers;
create policy "own_or_admin_linkedin_sheet_watchers" on linkedin_sheet_watchers
    for all using (
        exists (select 1 from linkedin_campaigns lc where lc.id = campaign_id and lc.user_id = auth.uid())
        or is_admin(auth.uid())
    );

drop policy if exists "own_or_admin_linkedin_opt_outs" on linkedin_opt_outs;
create policy "own_or_admin_linkedin_opt_outs" on linkedin_opt_outs
    for all using (user_id = auth.uid() or is_admin(auth.uid()));

-- ── user_stats: acrescenta linkedin_disparo_habilitado (última definição
-- era 0008_email_dispatch.sql) ────────────────────────────────────────
create or replace view user_stats as
select
    p.id, p.email, p.role,
    p.cdd_credits, p.monthly_cdd_credits,
    p.maps_credits, p.monthly_maps_credits, p.maps_credits_enabled,
    p.credits_renewed_at, p.created_at,
    count(distinct s.id) as total_searches,
    count(distinct l.id) as total_leads,
    max(s.created_at)    as last_search_at,
    p.instagram_credits, p.monthly_instagram_credits, p.instagram_credits_enabled,
    p.instagram_visible, p.disparo_habilitado, p.conta_teste, p.teste_expira_em,
    p.enriquecimento_ia_habilitado,
    p.linkedin_credits, p.monthly_linkedin_credits, p.linkedin_credits_enabled,
    p.linkedin_visible,
    p.email_disparo_habilitado,
    p.linkedin_disparo_habilitado
from profiles p
left join searches s on s.user_id = p.id
left join leads    l on l.user_id = p.id
group by p.id, p.email, p.role, p.cdd_credits, p.monthly_cdd_credits,
         p.maps_credits, p.monthly_maps_credits, p.maps_credits_enabled,
         p.credits_renewed_at, p.created_at,
         p.instagram_credits, p.monthly_instagram_credits, p.instagram_credits_enabled,
         p.instagram_visible, p.disparo_habilitado, p.conta_teste, p.teste_expira_em,
         p.enriquecimento_ia_habilitado,
         p.linkedin_credits, p.monthly_linkedin_credits, p.linkedin_credits_enabled,
         p.linkedin_visible,
         p.email_disparo_habilitado,
         p.linkedin_disparo_habilitado;
