-- ============================================================
-- Automações → Construtor de fluxos (estilo N8N/Make)
--
-- Substitui a limitação dos dois tipos fixos de automação (busca
-- agendada só CNPJ/Maps em `automations`; disparo por gatilho/sheet-watch
-- em `dispatch_campaigns.tipo_origem`) por um grafo de módulos conectáveis
-- (gatilho → extração → enriquecimento → disparo → destino), guardado como
-- JSON (nodes/edges) e executado nó a nó pelo worker (worker/flow-tick.ts).
--
-- Decisão deliberada: NÃO migra automações antigas pra esse formato — os 4
-- schedulers existentes (worker/index.ts) continuam rodando intocados, sem
-- risco de execução duplicada. `/automacoes` passa a ter uma seção nova
-- ("Fluxos") e mantém a antiga ("Automações antigas") pra quem já tinha
-- algo configurado.
--
-- Cada nó que produz leads (extração, fonte_historico) persiste em
-- `searches`+`leads` do mesmo jeito que automation-runner.ts já faz —
-- mantém tudo visível no Histórico normal e dá aos nós seguintes um
-- LeadRow[] real (com id), que é o que exportar() e o enriquecimento
-- (via enrichment_leads) já esperam.
-- ============================================================

create table if not exists automation_flows (
    id             uuid primary key default gen_random_uuid(),
    user_id        uuid not null references auth.users(id) on delete cascade,
    nome           text not null,
    ativo          boolean not null default true,
    nodes          jsonb not null default '[]'::jsonb,  -- [{id, tipo, config, posicao:{x,y}}]
    edges          jsonb not null default '[]'::jsonb,  -- [{id, from, to}]
    -- Estado mutável do nó-gatilho (1 por fluxo — grafo v1 é linear/DAG
    -- simples, um único gatilho na raiz): equivalente a
    -- automations.proxima_execucao/ultima_execucao (gatilho_agendado),
    -- dispatch_campaigns.ultimo_trigger_em (gatilho_filtro_leads) e
    -- dispatch_sheet_watchers.ultima_linha_processada (gatilho_planilha),
    -- só que consolidado aqui em vez de em 3 tabelas — quem consome é
    -- exclusivamente worker/flow-tick.ts.
    gatilho_estado jsonb not null default '{}'::jsonb,
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now()
);

create table if not exists flow_runs (
    id            uuid primary key default gen_random_uuid(),
    flow_id       uuid not null references automation_flows(id) on delete cascade,
    user_id       uuid not null references auth.users(id) on delete cascade,
    status        text not null default 'executando'
                  check (status in ('executando', 'aguardando_subprocesso', 'concluido', 'erro')),
    no_atual_id   text,                          -- id do nó em execução agora (referencia nodes[].id do flow)
    contexto      jsonb not null default '{}'::jsonb,  -- ids intermediários (searchId, enrichmentRunId, campaignId) pro tick continuar de onde parou
    iniciado_em   timestamptz not null default now(),
    concluido_em  timestamptz,
    erro          text
);

create table if not exists flow_run_steps (
    id            uuid primary key default gen_random_uuid(),
    run_id        uuid not null references flow_runs(id) on delete cascade,
    node_id       text not null,
    tipo          text not null,
    status        text not null default 'pendente'
                  check (status in ('pendente', 'executando', 'concluido', 'erro', 'pulado')),
    leads_entrada integer,
    leads_saida   integer,
    detalhe       jsonb,     -- ex: {searchId}, {enrichmentRunId}, {campaignId, inscritos}
    erro          text,
    iniciado_em   timestamptz,
    concluido_em  timestamptz
);

create index if not exists idx_flows_ativos on automation_flows(ativo) where ativo;
create index if not exists idx_flow_runs_ativas on flow_runs(status) where status in ('executando', 'aguardando_subprocesso');
create index if not exists idx_flow_run_steps_run on flow_run_steps(run_id);

alter table automation_flows enable row level security;
alter table flow_runs        enable row level security;
alter table flow_run_steps   enable row level security;

drop policy if exists "own_automation_flows" on automation_flows;
create policy "own_automation_flows" on automation_flows
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "admin_all_automation_flows" on automation_flows;
create policy "admin_all_automation_flows" on automation_flows
    for all using (is_admin(auth.uid()));

drop policy if exists "own_flow_runs" on flow_runs;
create policy "own_flow_runs" on flow_runs
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "admin_all_flow_runs" on flow_runs;
create policy "admin_all_flow_runs" on flow_runs
    for all using (is_admin(auth.uid()));

-- flow_run_steps não tem user_id próprio — visibilidade herda de flow_runs
-- via join (mesmo padrão de dispatch_messages_log, que também só tem
-- campaign_id/target_id e é lido através da campanha do dono).
drop policy if exists "own_or_admin_flow_run_steps" on flow_run_steps;
create policy "own_or_admin_flow_run_steps" on flow_run_steps
    for all using (
        exists (select 1 from flow_runs r where r.id = flow_run_steps.run_id and r.user_id = auth.uid())
        or is_admin(auth.uid())
    );
