-- ============================================================
-- Enriquecimento de leads via BigDataCorp (https://bigdatacorp.com.br) —
-- terceira via de enriquecimento, ao lado do Enriquecimento via IA
-- (0005_lead_enrichment_ia.sql). Diferença de fundo: a IA parte de
-- nome/e-mail/telefone e busca na web de forma especulativa; a BigDataCorp
-- consulta por CNPJ direto em bases de registro/cadastro (Receita Federal e
-- outras fontes), então o resultado (sócios/quadro societário + telefone/
-- e-mail cadastrados da empresa) tende a ser mais confiável quando o CNPJ é
-- conhecido — mas só funciona quando o CNPJ é conhecido, ao contrário da IA.
--
-- Chave única da plataforma por enquanto (BIGDATACORP_TOKEN_ID +
-- BIGDATACORP_ACCESS_TOKEN, custo absorvido pela plataforma) — ao
-- contrário do enriquecimento via IA (cada usuário usa a própria chave
-- OpenAI). Reavaliar esse modelo de custo depois (ver conversa com o
-- usuário) — por enquanto não há coluna de chave por usuário aqui.
--
-- Mesmo padrão assíncrono do enriquecimento via IA (worker processa em
-- background, não a requisição HTTP): cada lote pode ter várias consultas
-- pagas em sequência.
-- ============================================================

alter table profiles add column if not exists bigdatacorp_enrichment_habilitado boolean not null default false;

-- ── Execuções (lotes) ────────────────────────────────────────────
create table if not exists bigdatacorp_enrichment_runs (
    id                uuid primary key default gen_random_uuid(),
    user_id           uuid not null references auth.users(id) on delete cascade,
    status            text not null default 'pendente'
                      check (status in ('pendente', 'processando', 'concluido', 'erro')),
    total             integer not null default 0,
    processados       integer not null default 0,
    encontrados       integer not null default 0,
    nao_encontrados   integer not null default 0,
    erros             integer not null default 0,
    origem            text not null default 'manual' check (origem in ('manual', 'busca_cnpj', 'fluxo')),
    erro              text,
    created_at        timestamptz not null default now(),
    concluido_em      timestamptz
);

create index if not exists idx_bdc_enrichment_runs_user     on bigdatacorp_enrichment_runs(user_id, created_at desc);
create index if not exists idx_bdc_enrichment_runs_pendente on bigdatacorp_enrichment_runs(status, created_at) where status = 'pendente';

-- ── Leads de cada execução ───────────────────────────────────────
create table if not exists bigdatacorp_enrichment_leads (
    id                uuid primary key default gen_random_uuid(),
    run_id            uuid not null references bigdatacorp_enrichment_runs(id) on delete cascade,
    user_id           uuid not null references auth.users(id) on delete cascade,

    -- entrada
    cnpj_entrada      text not null,
    nome_lead         text,

    -- saída
    status            text not null default 'pendente'
                      check (status in ('pendente', 'concluido', 'nao_encontrado', 'erro')),
    razao_social      text,
    socios            jsonb,   -- [{ nome, documento, qualificacao }]
    telefone          text,
    email             text,
    endereco          text,
    -- resposta bruta da BigDataCorp pra esse CNPJ — guardada porque o
    -- schema exato do dataset de sócios/QSA não foi confirmado contra um
    -- servidor real (ver ressalva em src/lib/integrations/bigdatacorp.ts);
    -- serve de rede de segurança caso o parsing estruturado perca campo.
    extras            jsonb,
    erro              text,

    created_at        timestamptz not null default now()
);

create index if not exists idx_bdc_enrichment_leads_run  on bigdatacorp_enrichment_leads(run_id);
create index if not exists idx_bdc_enrichment_leads_user on bigdatacorp_enrichment_leads(user_id);

-- ── Row Level Security ────────────────────────────────────────
alter table bigdatacorp_enrichment_runs  enable row level security;
alter table bigdatacorp_enrichment_leads enable row level security;

drop policy if exists "own_or_admin_bdc_enrichment_runs" on bigdatacorp_enrichment_runs;
create policy "own_or_admin_bdc_enrichment_runs" on bigdatacorp_enrichment_runs
    for all using (user_id = auth.uid() or is_admin(auth.uid()));

drop policy if exists "own_or_admin_bdc_enrichment_leads" on bigdatacorp_enrichment_leads;
create policy "own_or_admin_bdc_enrichment_leads" on bigdatacorp_enrichment_leads
    for all using (user_id = auth.uid() or is_admin(auth.uid()));

-- ── user_stats: acrescenta bigdatacorp_enrichment_habilitado no final
-- (CREATE OR REPLACE VIEW só aceita colunas novas no fim da lista) ──
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
    p.linkedin_disparo_habilitado,
    p.bigdatacorp_enrichment_habilitado
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
         p.linkedin_disparo_habilitado,
         p.bigdatacorp_enrichment_habilitado;
