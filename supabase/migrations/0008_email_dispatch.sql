-- ============================================================
-- Disparo por e-mail — Resend. Espelha o disparo WhatsApp
-- (whatsapp_instances/dispatch_campaigns/dispatch_cadence_steps/
-- dispatch_targets/dispatch_messages_log/dispatch_sheet_watchers/
-- dispatch_opt_outs) o mais fielmente possível, com as diferenças que
-- o canal exige:
--   - Sem conceito de "instância conectada" (QR/status) — Resend é uma
--     única API key da plataforma; `email_senders` só guarda
--     nome/from/reply-to + limite diário + estado de pacing, sem
--     máquina de estados de conexão.
--   - Sem template Meta-aprovado — `email_templates` não tem
--     status_aprovacao/nome_meta/idioma/componentes/meta_template_id;
--     ganha `assunto` (WhatsApp não tem assunto).
--   - `intervalo_min_seg`/`intervalo_max_seg` de `email_campaigns`
--     pausam entre LOTES (o worker envia em lote via Resend, não 1 a 1
--     como o WhatsApp) — não entre mensagens individuais.
--   - Sem anexos (`midia_url` equivalente) nesta v1 — decisão
--     deliberada, ver README.
-- ============================================================

alter table profiles add column if not exists email_disparo_habilitado boolean not null default false;

create table if not exists email_senders (
    id                         uuid primary key default gen_random_uuid(),
    user_id                    uuid not null references auth.users(id) on delete cascade,
    nome                       text not null,
    from_name                  text not null,
    from_email                 text not null,
    reply_to                   text,
    ativo                      boolean not null default true,
    limite_diario_envios       integer,
    ultimo_envio_em            timestamptz,
    proximo_envio_liberado_em  timestamptz,
    criado_em                  timestamptz not null default now()
);

create table if not exists email_campaigns (
    id                uuid primary key default gen_random_uuid(),
    user_id           uuid not null references auth.users(id) on delete cascade,
    nome              text not null,
    sender_id         uuid references email_senders(id),
    status            text not null default 'rascunho' check (status in ('rascunho', 'ativa', 'pausada', 'concluida')),
    tipo_origem       text not null check (tipo_origem in ('busca_existente', 'upload', 'manual', 'auto_trigger', 'sheet_watch')),
    origem_search_id  uuid references searches(id),
    filtro_nicho      text,
    filtro_subnicho   text,
    filtro_uf         text,
    ultimo_trigger_em timestamptz,
    -- Pacing entre LOTES (o worker envia em lote via Resend) — não entre
    -- mensagens individuais como no disparo WhatsApp. Ver comentário no
    -- topo do arquivo.
    intervalo_min_seg integer not null default 5,
    intervalo_max_seg integer not null default 15,
    criado_em         timestamptz not null default now()
);

create table if not exists email_templates (
    id         uuid primary key default gen_random_uuid(),
    user_id    uuid not null references auth.users(id) on delete cascade,
    nome       text not null,
    assunto    text not null,
    corpo      text not null,
    criado_em  timestamptz not null default now()
);

create table if not exists email_cadence_steps (
    id           uuid primary key default gen_random_uuid(),
    campaign_id  uuid not null references email_campaigns(id) on delete cascade,
    ordem        integer not null,
    atraso_horas numeric not null default 0,
    assunto      text not null,
    corpo        text not null,
    -- Só conveniência de UI (pré-preencher assunto/corpo a partir de um
    -- template salvo) — o valor efetivamente enviado é sempre
    -- assunto/corpo desta linha, nunca lido do template em tempo de envio.
    template_id  uuid references email_templates(id),
    criado_em    timestamptz not null default now()
);

create table if not exists email_targets (
    id                uuid primary key default gen_random_uuid(),
    campaign_id       uuid not null references email_campaigns(id) on delete cascade,
    nome              text,
    email             text not null,
    lead_snapshot     jsonb,
    status            text not null default 'pendente' check (status in ('pendente', 'enviando', 'enviado', 'concluido', 'falhou', 'removido')),
    current_step_id   uuid references email_cadence_steps(id),
    proxima_etapa_em  timestamptz not null default now(),
    reservado_em      timestamptz,
    criado_em         timestamptz not null default now(),
    atualizado_em     timestamptz not null default now(),
    unique (campaign_id, email)
);
create index if not exists idx_email_targets_scan  on email_targets(campaign_id, status, proxima_etapa_em);
create index if not exists idx_email_targets_email on email_targets(email);

create table if not exists email_messages_log (
    id                    uuid primary key default gen_random_uuid(),
    target_id             uuid not null references email_targets(id) on delete cascade,
    campaign_id           uuid not null references email_campaigns(id) on delete cascade,
    step_id               uuid references email_cadence_steps(id),
    enviado_em            timestamptz not null default now(),
    status                text not null check (status in ('sucesso', 'erro')),
    provider_message_id   text,
    erro_msg              text,
    assunto_enviado       text,
    corpo_enviado         text
);

create table if not exists email_sheet_watchers (
    id                       uuid primary key default gen_random_uuid(),
    campaign_id              uuid not null references email_campaigns(id) on delete cascade,
    sheet_id                 text not null,
    aba_nome                 text not null,
    coluna_email             text not null,
    coluna_nome              text,
    ultima_linha_processada  integer not null default 0,
    criado_em                timestamptz not null default now()
);

create table if not exists email_opt_outs (
    email      text not null,
    user_id    uuid not null references auth.users(id) on delete cascade,
    criado_em  timestamptz not null default now(),
    motivo     text,
    primary key (email, user_id)
);

-- Reivindicação atômica de até p_limit alvos prontos pra envio de UMA
-- campanha — evita disparo duplicado entre ticks do worker. Ao contrário
-- de claim_dispatch_target (1 alvo por instância), aqui reivindica um LOTE
-- por campanha de uma vez, porque o envio é feito em lote via a API de
-- batch da Resend (ver worker/email-dispatch-tick.ts).
create or replace function claim_email_targets(p_campaign_id uuid, p_limit integer default 20)
returns setof email_targets as $$
    update email_targets
    set status = 'enviando', reservado_em = now()
    where id in (
        select et.id from email_targets et
        join email_campaigns ec on ec.id = et.campaign_id
        where et.campaign_id = p_campaign_id
          and ec.status = 'ativa'
          and et.status = 'pendente'
          and et.proxima_etapa_em <= now()
        order by et.proxima_etapa_em
        limit p_limit
        for update of et skip locked
    )
    returning *;
$$ language sql volatile;

-- ── RLS: dono da linha ou admin — usa is_admin() (padrão desde 0003,
-- consolidado em 0007), não a subconsulta inline de 0002. ─────────────
alter table email_senders        enable row level security;
alter table email_campaigns      enable row level security;
alter table email_templates      enable row level security;
alter table email_cadence_steps  enable row level security;
alter table email_targets        enable row level security;
alter table email_messages_log   enable row level security;
alter table email_sheet_watchers enable row level security;
alter table email_opt_outs       enable row level security;

drop policy if exists "own_or_admin_email_senders" on email_senders;
create policy "own_or_admin_email_senders" on email_senders
    for all using (user_id = auth.uid() or is_admin(auth.uid()));

drop policy if exists "own_or_admin_email_campaigns" on email_campaigns;
create policy "own_or_admin_email_campaigns" on email_campaigns
    for all using (user_id = auth.uid() or is_admin(auth.uid()));

drop policy if exists "own_or_admin_email_templates" on email_templates;
create policy "own_or_admin_email_templates" on email_templates
    for all using (user_id = auth.uid() or is_admin(auth.uid()));

drop policy if exists "own_or_admin_email_cadence_steps" on email_cadence_steps;
create policy "own_or_admin_email_cadence_steps" on email_cadence_steps
    for all using (
        exists (select 1 from email_campaigns ec where ec.id = campaign_id and ec.user_id = auth.uid())
        or is_admin(auth.uid())
    );

drop policy if exists "own_or_admin_email_targets" on email_targets;
create policy "own_or_admin_email_targets" on email_targets
    for all using (
        exists (select 1 from email_campaigns ec where ec.id = campaign_id and ec.user_id = auth.uid())
        or is_admin(auth.uid())
    );

drop policy if exists "own_or_admin_email_messages_log" on email_messages_log;
create policy "own_or_admin_email_messages_log" on email_messages_log
    for all using (
        exists (select 1 from email_campaigns ec where ec.id = campaign_id and ec.user_id = auth.uid())
        or is_admin(auth.uid())
    );

drop policy if exists "own_or_admin_email_sheet_watchers" on email_sheet_watchers;
create policy "own_or_admin_email_sheet_watchers" on email_sheet_watchers
    for all using (
        exists (select 1 from email_campaigns ec where ec.id = campaign_id and ec.user_id = auth.uid())
        or is_admin(auth.uid())
    );

drop policy if exists "own_or_admin_email_opt_outs" on email_opt_outs;
create policy "own_or_admin_email_opt_outs" on email_opt_outs
    for all using (user_id = auth.uid() or is_admin(auth.uid()));

-- ── user_stats: acrescenta email_disparo_habilitado (última definição
-- era 0006_linkedin_extraction.sql) ────────────────────────────────
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
    p.email_disparo_habilitado
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
         p.email_disparo_habilitado;
