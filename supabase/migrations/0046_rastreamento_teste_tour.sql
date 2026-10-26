-- ============================================================
-- Rastreamento da página de vendas, conversão do teste grátis e tour.
--
-- 1. lp_eventos: cada passo de quem visita a página de vendas (visita,
--    seção vista, clique, checkout, conta criada, teste iniciado, compra),
--    com a origem da campanha (utm_*). Alimenta o painel /admin/funil-lp.
--    Escrita só pelo servidor (rota /api/lp/evento e webhooks), leitura só
--    pelo painel de admin via lp_painel() — nenhuma policy para usuários.
-- 2. profiles.rastreamento: origem da conta (visitante, utm, cookies da
--    Meta, IP e navegador no cadastro), usada para atribuir a compra à
--    campanha e para a API de Conversões da Meta.
-- 3. profiles.tour_visto: quando a pessoa viu (ou pulou) o tour guiado,
--    por público ("teste" e "assinante" são tours diferentes).
-- 4. profiles.emails_retomada / emails_retomada_off: etapas já enviadas da
--    sequência de e-mails de quem está no teste ou não concluiu o pagamento,
--    e o descadastro dessa sequência.
--
-- Todas as colunas novas ficam fora da lista livre de proteger_campos_profile
-- (0028): só o servidor (service role) grava.
-- ============================================================

create table if not exists lp_eventos (
    id            bigserial primary key,
    criado_em     timestamptz not null default now(),
    visitante     text not null,
    sessao        text,
    evento        text not null,
    pagina        text,
    alvo          text,
    user_id       uuid references auth.users(id) on delete set null,
    utm_source    text,
    utm_medium    text,
    utm_campaign  text,
    utm_content   text,
    utm_term      text,
    referrer      text,
    dispositivo   text
);

create index if not exists lp_eventos_criado_em_idx on lp_eventos (criado_em);
create index if not exists lp_eventos_evento_criado_em_idx on lp_eventos (evento, criado_em);
create index if not exists lp_eventos_visitante_idx on lp_eventos (visitante);

alter table lp_eventos enable row level security;
revoke all on lp_eventos from anon, authenticated;

alter table profiles add column if not exists rastreamento jsonb;
alter table profiles add column if not exists tour_visto jsonb not null default '{}'::jsonb;
alter table profiles add column if not exists emails_retomada jsonb not null default '{}'::jsonb;
alter table profiles add column if not exists emails_retomada_off boolean not null default false;

-- ------------------------------------------------------------
-- Painel do funil: tudo agregado no banco, numa chamada só.
-- Etapas contam VISITANTES únicos (não eventos), para a taxa entre uma
-- etapa e a seguinte fazer sentido.
-- ------------------------------------------------------------
create or replace function lp_painel(p_inicio timestamptz, p_fim timestamptz, p_campanha text default null)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
with base as (
    select *
    from lp_eventos
    where criado_em >= p_inicio and criado_em < p_fim
      and (p_campanha is null or utm_campaign = p_campanha)
),
etapas as (
    select 'visitou'            as etapa, count(distinct visitante) as n from base where evento = 'pagina_vista' and pagina = '/conheca'
    union all select 'viu_planos',        count(distinct visitante) from base where evento = 'secao_vista' and alvo = 'planos'
    union all select 'clicou_assinar',    count(distinct visitante) from base where evento = 'clique' and alvo like 'assinar%'
    union all select 'clicou_teste',      count(distinct visitante) from base where evento = 'clique' and alvo like 'teste%'
    union all select 'clicou_whatsapp',   count(distinct visitante) from base where evento = 'clique' and alvo like 'whatsapp%'
    union all select 'abriu_checkout',    count(distinct visitante) from base where evento = 'pagina_vista' and pagina = '/assinar'
    union all select 'abriu_teste',       count(distinct visitante) from base where evento = 'pagina_vista' and pagina = '/teste-gratis'
    union all select 'criou_conta',       count(distinct visitante) from base where evento = 'conta_criada'
    union all select 'iniciou_teste',     count(distinct visitante) from base where evento = 'teste_criado'
    union all select 'comprou',           count(distinct visitante) from base where evento = 'compra'
),
secoes as (
    select alvo, count(distinct visitante) as n
    from base where evento = 'secao_vista' and alvo is not null
    group by alvo
),
cliques as (
    select alvo, count(*) as total, count(distinct visitante) as visitantes
    from base where evento = 'clique' and alvo is not null
    group by alvo
    order by count(distinct visitante) desc
    limit 25
),
origens as (
    select coalesce(nullif(utm_source, ''), '(direto)') as fonte,
           coalesce(nullif(utm_campaign, ''), '(sem campanha)') as campanha,
           coalesce(nullif(utm_content, ''), '') as anuncio,
           count(distinct visitante) filter (where evento = 'pagina_vista') as visitantes,
           count(distinct visitante) filter (where evento = 'pagina_vista' and pagina = '/assinar') as checkouts,
           count(distinct visitante) filter (where evento = 'teste_criado') as testes,
           count(distinct visitante) filter (where evento = 'conta_criada') as contas,
           count(distinct visitante) filter (where evento = 'compra') as compras
    from base
    group by 1, 2, 3
    order by 4 desc
    limit 40
),
dias as (
    select to_char(date_trunc('day', criado_em at time zone 'America/Sao_Paulo'), 'YYYY-MM-DD') as dia,
           count(distinct visitante) filter (where evento = 'pagina_vista') as visitantes,
           count(distinct visitante) filter (where evento = 'teste_criado') as testes,
           count(distinct visitante) filter (where evento = 'conta_criada') as contas,
           count(distinct visitante) filter (where evento = 'compra') as compras
    from base
    group by 1
    order by 1
),
dispositivos as (
    select coalesce(dispositivo, 'desconhecido') as dispositivo, count(distinct visitante) as n
    from base where evento = 'pagina_vista'
    group by 1
),
campanhas as (
    select distinct utm_campaign from lp_eventos
    where criado_em >= p_inicio and criado_em < p_fim and coalesce(utm_campaign, '') <> ''
    limit 100
)
select jsonb_build_object(
    'etapas',       coalesce((select jsonb_object_agg(etapa, n) from etapas), '{}'::jsonb),
    'secoes',       coalesce((select jsonb_object_agg(alvo, n) from secoes), '{}'::jsonb),
    'cliques',      coalesce((select jsonb_agg(jsonb_build_object('alvo', alvo, 'total', total, 'visitantes', visitantes)) from cliques), '[]'::jsonb),
    'origens',      coalesce((select jsonb_agg(to_jsonb(o)) from origens o), '[]'::jsonb),
    'dias',         coalesce((select jsonb_agg(to_jsonb(d)) from dias d), '[]'::jsonb),
    'dispositivos', coalesce((select jsonb_object_agg(dispositivo, n) from dispositivos), '{}'::jsonb),
    'campanhas',    coalesce((select jsonb_agg(utm_campaign order by utm_campaign) from campanhas), '[]'::jsonb)
);
$$;

revoke execute on function lp_painel(timestamptz, timestamptz, text) from public, anon, authenticated;
grant execute on function lp_painel(timestamptz, timestamptz, text) to service_role;
