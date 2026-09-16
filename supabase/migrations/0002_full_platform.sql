-- ============================================================
-- Nova Plataforma de Prospecção · Plataforma completa
-- Adiciona: Instagram (Apify), Apify Maps (fallback), Google Sheets,
-- disparo WhatsApp (Evolution + oficial), automações, contas de teste.
-- Execute depois de 0001_init.sql.
-- ============================================================

-- ── Perfis: credenciais e visibilidade adicionais ───────────────
alter table profiles add column if not exists apify_api_key             text;
alter table profiles add column if not exists apify_api_key_admin       text;
alter table profiles add column if not exists apify_keys_pool           jsonb not null default '[]'::jsonb;
alter table profiles add column if not exists instagram_credits         integer not null default 0;
alter table profiles add column if not exists monthly_instagram_credits integer not null default 0;
alter table profiles add column if not exists instagram_credits_enabled boolean not null default false;
alter table profiles add column if not exists instagram_visible         boolean not null default true;
alter table profiles add column if not exists disparo_habilitado        boolean not null default false;
alter table profiles add column if not exists conta_teste               boolean not null default false;
alter table profiles add column if not exists teste_expira_em           timestamptz;

-- Google Sheets — credenciais OAuth do próprio usuário + config de export
alter table profiles add column if not exists google_client_id     text;
alter table profiles add column if not exists google_client_secret text;
alter table profiles add column if not exists google_sheets_creds  jsonb; -- {oauth, planilhas: [{id,nome,aba,padrao,modo}], auto_export}

-- ── Débito atômico: agora aceita instagram_credits também ───────
create or replace function decrement_credits(
    p_user_id uuid,
    p_campo   text,
    p_delta   integer
) returns void
language plpgsql security definer as $$
begin
    if p_campo not in ('cdd_credits', 'maps_credits', 'instagram_credits') then
        raise exception 'Campo inválido: %', p_campo;
    end if;
    if p_delta <= 0 then
        return;
    end if;
    execute format(
        'update profiles set %I = greatest(0, %I - $1) where id = $2',
        p_campo, p_campo
    ) using p_delta, p_user_id;
end;
$$;

-- ── searches: aceitar fonte 'instagram' ──────────────────────────
alter table searches drop constraint if exists searches_fonte_check;
alter table searches add constraint searches_fonte_check
    check (fonte in ('cnpj', 'google_maps', 'instagram'));

-- ── leads: campos de Instagram ───────────────────────────────────
alter table leads add column if not exists instagram_id text;
alter table leads add column if not exists username     text;

-- ── Configuração global da plataforma (linha única) ──────────────
-- Guarda o pool da chave Google Maps compartilhada entre contas de teste
-- (mesmo formato de maps_keys_pool). Só lido/gravado via service role.
create table if not exists platform_settings (
    id              int primary key default 1,
    maps_pool_teste jsonb not null default '[]'::jsonb,
    constraint platform_settings_singleton check (id = 1)
);
insert into platform_settings (id) values (1) on conflict (id) do nothing;
alter table platform_settings enable row level security;

-- ── Recria user_stats com os campos novos ────────────────────────
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
    p.instagram_visible, p.disparo_habilitado, p.conta_teste, p.teste_expira_em
from profiles p
left join searches s on s.user_id = p.id
left join leads    l on l.user_id = p.id
group by p.id, p.email, p.role, p.cdd_credits, p.monthly_cdd_credits,
         p.maps_credits, p.monthly_maps_credits, p.maps_credits_enabled,
         p.credits_renewed_at, p.created_at,
         p.instagram_credits, p.monthly_instagram_credits, p.instagram_credits_enabled,
         p.instagram_visible, p.disparo_habilitado, p.conta_teste, p.teste_expira_em;

-- ============================================================
-- Automações — busca (CNPJ/Maps) programada, com export Sheets e
-- disparo vinculado opcionais.
-- ============================================================
create table if not exists automations (
    id                    uuid primary key default gen_random_uuid(),
    user_id               uuid not null references auth.users(id) on delete cascade,
    nome                  text not null,
    tipo                  text not null check (tipo in ('maps', 'cnpj')),
    filtros               jsonb not null default '{}',
    sheet_id              text,
    sheet_aba             text default 'Leads',
    dias_semana           integer[] not null default array[1,2,3,4,5],
    horario               text not null default '08:00',
    ativa                 boolean not null default true,
    ultima_execucao       timestamptz,
    proxima_execucao      timestamptz,
    dispatch_campaign_id  uuid,
    created_at            timestamptz not null default now()
);

create index if not exists idx_automations_vencidas on automations(ativa, proxima_execucao);

alter table automations enable row level security;
drop policy if exists "own_automations" on automations;
create policy "own_automations" on automations
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "admin_all_automations" on automations;
create policy "admin_all_automations" on automations
    for all using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

create table if not exists automation_runs (
    id                uuid primary key default gen_random_uuid(),
    automation_id     uuid not null references automations(id) on delete cascade,
    user_id           uuid not null references auth.users(id) on delete cascade,
    iniciada_em       timestamptz default now(),
    concluida_em      timestamptz,
    leads_encontrados integer default 0,
    status            text check (status in ('running','success','error','sem_creditos','sem_sheets')),
    erro              text
);

alter table automation_runs enable row level security;
drop policy if exists "own_automation_runs" on automation_runs;
create policy "own_automation_runs" on automation_runs
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "admin_all_automation_runs" on automation_runs;
create policy "admin_all_automation_runs" on automation_runs
    for all using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

-- ============================================================
-- Disparo WhatsApp — Evolution API (não-oficial) + WhatsApp Business
-- Cloud API oficial (via provedor tipo DatafyAPI). Campo `canal` desde
-- o início, pronto para outros canais nas próximas fases.
-- ============================================================

create table if not exists whatsapp_instances (
    id                         uuid primary key default gen_random_uuid(),
    user_id                    uuid not null references auth.users(id) on delete cascade,
    nome                       text not null,
    canal                      text not null default 'evolution' check (canal in ('evolution', 'oficial')),
    evolution_instance_name    text,
    status                     text not null default 'desconectado' check (status in ('desconectado', 'conectando', 'conectado')),
    numero_conectado           text,
    ultimo_envio_em            timestamptz,
    proximo_envio_liberado_em  timestamptz,
    limite_diario_envios       integer,
    token_oficial              text,
    phone_number_id            text,
    waba_id                    text,
    criado_em                  timestamptz not null default now()
);

create table if not exists dispatch_campaigns (
    id                uuid primary key default gen_random_uuid(),
    user_id           uuid not null references auth.users(id) on delete cascade,
    nome              text not null,
    instance_id       uuid references whatsapp_instances(id),
    status            text not null default 'rascunho' check (status in ('rascunho', 'ativa', 'pausada', 'concluida')),
    tipo_origem       text not null check (tipo_origem in ('busca_existente', 'upload', 'manual', 'auto_trigger', 'sheet_watch')),
    origem_search_id  uuid references searches(id),
    filtro_nicho      text,
    filtro_subnicho   text,
    filtro_uf         text,
    ultimo_trigger_em timestamptz,
    intervalo_min_seg integer not null default 30,
    intervalo_max_seg integer not null default 90,
    criado_em         timestamptz not null default now()
);

alter table automations add constraint automations_dispatch_campaign_id_fkey
    foreign key (dispatch_campaign_id) references dispatch_campaigns(id) on delete set null;

create table if not exists message_templates (
    id               uuid primary key default gen_random_uuid(),
    user_id          uuid not null references auth.users(id) on delete cascade,
    instance_id      uuid references whatsapp_instances(id),
    nome             text not null,
    categoria        text,
    corpo            text not null,
    variaveis        jsonb default '[]'::jsonb,
    canal            text not null default 'evolution' check (canal in ('evolution', 'oficial')),
    status_aprovacao text not null default 'rascunho',
    nome_meta        text,
    idioma           text default 'pt_BR',
    componentes      jsonb default '[]'::jsonb,
    meta_template_id text,
    criado_em        timestamptz not null default now()
);

create table if not exists dispatch_cadence_steps (
    id                   uuid primary key default gen_random_uuid(),
    campaign_id          uuid not null references dispatch_campaigns(id) on delete cascade,
    ordem                integer not null,
    atraso_horas         numeric not null default 0,
    corpo_mensagem       text not null,
    midia_url            text,
    template_id          uuid references message_templates(id),
    parametros_template  jsonb default '[]'::jsonb,
    criado_em            timestamptz not null default now()
);

create table if not exists dispatch_targets (
    id                uuid primary key default gen_random_uuid(),
    campaign_id       uuid not null references dispatch_campaigns(id) on delete cascade,
    nome              text,
    telefone          text not null,
    lead_snapshot     jsonb,
    status            text not null default 'pendente' check (status in ('pendente', 'enviando', 'enviado', 'concluido', 'falhou', 'removido')),
    current_step_id   uuid references dispatch_cadence_steps(id),
    proxima_etapa_em  timestamptz not null default now(),
    reservado_em      timestamptz,
    criado_em         timestamptz not null default now(),
    atualizado_em     timestamptz not null default now(),
    unique (campaign_id, telefone)
);
create index if not exists idx_dispatch_targets_scan on dispatch_targets(campaign_id, status, proxima_etapa_em);
create index if not exists idx_dispatch_targets_tel   on dispatch_targets(telefone);

create table if not exists dispatch_messages_log (
    id                    uuid primary key default gen_random_uuid(),
    target_id             uuid not null references dispatch_targets(id) on delete cascade,
    campaign_id           uuid not null references dispatch_campaigns(id) on delete cascade,
    step_id               uuid references dispatch_cadence_steps(id),
    enviado_em            timestamptz not null default now(),
    status                text not null check (status in ('sucesso', 'erro')),
    evolution_message_id  text,
    erro_msg              text,
    corpo_enviado         text
);

create table if not exists dispatch_sheet_watchers (
    id                       uuid primary key default gen_random_uuid(),
    campaign_id              uuid not null references dispatch_campaigns(id) on delete cascade,
    sheet_id                 text not null,
    aba_nome                 text not null,
    coluna_telefone          text not null,
    coluna_nome              text,
    ultima_linha_processada  integer not null default 0,
    criado_em                timestamptz not null default now()
);

create table if not exists dispatch_opt_outs (
    telefone   text not null,
    user_id    uuid not null references auth.users(id) on delete cascade,
    criado_em  timestamptz not null default now(),
    motivo     text,
    primary key (telefone, user_id)
);

create table if not exists oficial_connection_requests (
    id                uuid primary key default gen_random_uuid(),
    user_id           uuid not null references auth.users(id) on delete cascade,
    nome_desejado     text,
    telefone_contato  text,
    status            text not null default 'pendente' check (status in ('pendente', 'em_andamento', 'concluido')),
    observacao        text,
    instance_id       uuid references whatsapp_instances(id),
    criado_em         timestamptz not null default now(),
    atualizado_em     timestamptz not null default now()
);

-- Reivindicação atômica de 1 alvo pronto pra envio por instância — evita
-- disparo duplicado entre ticks do scheduler.
create or replace function claim_dispatch_target(p_instance_id uuid)
returns setof dispatch_targets as $$
    update dispatch_targets
    set status = 'enviando', reservado_em = now()
    where id = (
        select dt.id from dispatch_targets dt
        join dispatch_campaigns dc on dc.id = dt.campaign_id
        where dc.instance_id = p_instance_id
          and dc.status = 'ativa'
          and dt.status = 'pendente'
          and dt.proxima_etapa_em <= now()
        order by dt.proxima_etapa_em
        limit 1
        for update of dt skip locked
    )
    returning *;
$$ language sql volatile;

-- ── RLS: dono da linha ou admin (worker de background usa service role,
-- que ignora RLS — isso aqui é defesa em profundidade) ──────────────────
alter table whatsapp_instances       enable row level security;
alter table dispatch_campaigns       enable row level security;
alter table dispatch_cadence_steps   enable row level security;
alter table dispatch_targets         enable row level security;
alter table dispatch_messages_log    enable row level security;
alter table dispatch_sheet_watchers  enable row level security;
alter table dispatch_opt_outs        enable row level security;
alter table message_templates        enable row level security;
alter table oficial_connection_requests enable row level security;

drop policy if exists "own_or_admin_whatsapp_instances" on whatsapp_instances;
create policy "own_or_admin_whatsapp_instances" on whatsapp_instances
    for all using (user_id = auth.uid() or exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

drop policy if exists "own_or_admin_dispatch_campaigns" on dispatch_campaigns;
create policy "own_or_admin_dispatch_campaigns" on dispatch_campaigns
    for all using (user_id = auth.uid() or exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

drop policy if exists "own_or_admin_dispatch_cadence_steps" on dispatch_cadence_steps;
create policy "own_or_admin_dispatch_cadence_steps" on dispatch_cadence_steps
    for all using (
        exists (select 1 from dispatch_campaigns dc where dc.id = campaign_id and dc.user_id = auth.uid())
        or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
    );

drop policy if exists "own_or_admin_dispatch_targets" on dispatch_targets;
create policy "own_or_admin_dispatch_targets" on dispatch_targets
    for all using (
        exists (select 1 from dispatch_campaigns dc where dc.id = campaign_id and dc.user_id = auth.uid())
        or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
    );

drop policy if exists "own_or_admin_dispatch_messages_log" on dispatch_messages_log;
create policy "own_or_admin_dispatch_messages_log" on dispatch_messages_log
    for all using (
        exists (select 1 from dispatch_campaigns dc where dc.id = campaign_id and dc.user_id = auth.uid())
        or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
    );

drop policy if exists "own_or_admin_dispatch_sheet_watchers" on dispatch_sheet_watchers;
create policy "own_or_admin_dispatch_sheet_watchers" on dispatch_sheet_watchers
    for all using (
        exists (select 1 from dispatch_campaigns dc where dc.id = campaign_id and dc.user_id = auth.uid())
        or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
    );

drop policy if exists "own_or_admin_dispatch_opt_outs" on dispatch_opt_outs;
create policy "own_or_admin_dispatch_opt_outs" on dispatch_opt_outs
    for all using (user_id = auth.uid() or exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

drop policy if exists "own_or_admin_message_templates" on message_templates;
create policy "own_or_admin_message_templates" on message_templates
    for all using (user_id = auth.uid() or exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

drop policy if exists "own_or_admin_oficial_connection_requests" on oficial_connection_requests;
create policy "own_or_admin_oficial_connection_requests" on oficial_connection_requests
    for all using (user_id = auth.uid() or exists (select 1 from profiles where id = auth.uid() and role = 'admin'));
