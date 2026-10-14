-- ════════════════════════════════════════════════════════════════════
-- 0039 — Mapa dos resultados
--
-- 1. Leads ganham coordenadas e o bairro. Na busca do Google Maps as
--    coordenadas vêm prontas (precisão "exata"); na de CNPJ o endereço é
--    convertido em coordenada quando a pessoa abre o mapa ("rua",
--    "bairro" ou "cidade", conforme o que foi possível achar).
-- 2. Cache compartilhado de endereço → coordenada: o mesmo endereço não é
--    consultado duas vezes (e as consultas ao serviço gratuito de mapas
--    ficam baixas). Só o servidor lê e grava (sem política de RLS).
-- ════════════════════════════════════════════════════════════════════

alter table leads add column if not exists bairro text;
alter table leads add column if not exists latitude double precision;
alter table leads add column if not exists longitude double precision;
alter table leads add column if not exists geo_precisao text
    check (geo_precisao in ('exata', 'rua', 'bairro', 'cidade', 'nao_encontrado'));

create table if not exists geocodificacoes (
    chave       text primary key,
    latitude    double precision,
    longitude   double precision,
    precisao    text not null,
    criado_em   timestamptz not null default now()
);
alter table geocodificacoes enable row level security;
