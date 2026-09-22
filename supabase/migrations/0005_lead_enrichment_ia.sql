-- ============================================================
-- Enriquecimento de Leads via IA — feature nova do produto atual
-- (branch claude/lawyer-prospect-database-5Bfil em prospec-o-ativa),
-- portada aqui. Transforma nome/e-mail/telefone em dados comerciais
-- (empresa, cargo, site, LinkedIn, sócios, fundação, indício de
-- processo judicial) via um modelo OpenAI com busca na web.
--
-- Desativada por padrão; admin libera por usuário (mesmo padrão de
-- instagram_visible/disparo_habilitado). Cada usuário usa a PRÓPRIA
-- chave OpenAI — o custo da IA é do usuário, não da plataforma (mesma
-- decisão do produto atual).
--
-- Diferença deliberada em relação ao produto atual: lá o resultado só
-- existe em session_state (perdido ao atualizar a página) e roda
-- síncrono na mesma requisição. Aqui roda em background pelo worker
-- (mesmo padrão das automações) e fica persistido — evita perder um
-- lote de buscas pagas por atualizar a página, e não depende de manter
-- uma requisição HTTP aberta por vários minutos (cada busca de IA pode
-- levar até 240s, e o lote tem até 50 leads).
-- ============================================================

alter table profiles add column if not exists enriquecimento_ia_habilitado boolean not null default false;
alter table profiles add column if not exists openai_api_key text;

-- ── Execuções (lotes) de enriquecimento ─────────────────────────
create table if not exists enrichment_runs (
    id                uuid primary key default gen_random_uuid(),
    user_id           uuid not null references auth.users(id) on delete cascade,
    status            text not null default 'pendente'
                      check (status in ('pendente', 'processando', 'concluido', 'erro')),
    total             integer not null default 0,
    processados       integer not null default 0,
    encontrados       integer not null default 0,
    nao_encontrados   integer not null default 0,
    erros             integer not null default 0,
    -- nivel_raciocinio + buscar_socios/buscar_fundacao/buscar_processos +
    -- campos_customizados usados nesse lote — guardado pra exibir/repetir
    -- e pra manter o worker sem acoplar aos nomes exatos dos campos.
    opcoes            jsonb not null default '{}'::jsonb,
    erro              text,
    created_at        timestamptz not null default now(),
    concluido_em      timestamptz
);

create index if not exists idx_enrichment_runs_user    on enrichment_runs(user_id, created_at desc);
create index if not exists idx_enrichment_runs_pendente on enrichment_runs(status, created_at) where status = 'pendente';

-- ── Leads de cada execução ───────────────────────────────────────
create table if not exists enrichment_leads (
    id                  uuid primary key default gen_random_uuid(),
    run_id              uuid not null references enrichment_runs(id) on delete cascade,
    user_id             uuid not null references auth.users(id) on delete cascade,

    -- entrada
    nome_lead           text,
    email               text,
    telefone            text,

    -- saída
    status              text not null default 'pendente'
                        check (status in ('pendente', 'concluido', 'nao_encontrado', 'erro')),
    empresa_nome        text,
    cargo               text,
    cnpj                text,
    municipio           text,
    uf                  text,
    website             text,
    linkedin_url        text,
    resumo              text,
    socios              text,
    fundacao            text,
    processos_jusbrasil text,
    extras              jsonb,
    erro                text,

    created_at          timestamptz not null default now()
);

create index if not exists idx_enrichment_leads_run  on enrichment_leads(run_id);
create index if not exists idx_enrichment_leads_user on enrichment_leads(user_id);

-- ── Row Level Security ────────────────────────────────────────
alter table enrichment_runs  enable row level security;
alter table enrichment_leads enable row level security;

drop policy if exists "own_enrichment_runs" on enrichment_runs;
create policy "own_enrichment_runs" on enrichment_runs
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "admin_all_enrichment_runs" on enrichment_runs;
create policy "admin_all_enrichment_runs" on enrichment_runs
    for all using (is_admin(auth.uid()));

drop policy if exists "own_enrichment_leads" on enrichment_leads;
create policy "own_enrichment_leads" on enrichment_leads
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "admin_all_enrichment_leads" on enrichment_leads;
create policy "admin_all_enrichment_leads" on enrichment_leads
    for all using (is_admin(auth.uid()));

-- ── user_stats: acrescenta enriquecimento_ia_habilitado no final
-- (CREATE OR REPLACE VIEW só aceita colunas novas no fim da lista) ──
create or replace view user_stats as
select
    p.id,
    p.email,
    p.role,
    p.cdd_credits,
    p.monthly_cdd_credits,
    p.maps_credits,
    p.monthly_maps_credits,
    p.maps_credits_enabled,
    p.credits_renewed_at,
    p.created_at,
    count(distinct s.id) as total_searches,
    count(distinct l.id) as total_leads,
    max(s.created_at)    as last_search_at,
    p.instagram_credits,
    p.monthly_instagram_credits,
    p.instagram_credits_enabled,
    p.instagram_visible,
    p.disparo_habilitado,
    p.conta_teste,
    p.teste_expira_em,
    p.enriquecimento_ia_habilitado
from profiles p
left join searches s on s.user_id = p.id
left join leads    l on l.user_id = p.id
group by p.id, p.email, p.role, p.cdd_credits, p.monthly_cdd_credits,
         p.maps_credits, p.monthly_maps_credits, p.maps_credits_enabled,
         p.credits_renewed_at, p.created_at, p.instagram_credits,
         p.monthly_instagram_credits, p.instagram_credits_enabled,
         p.instagram_visible, p.disparo_habilitado, p.conta_teste,
         p.teste_expira_em, p.enriquecimento_ia_habilitado;
