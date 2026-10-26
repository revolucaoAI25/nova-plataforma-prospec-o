-- ============================================================
-- Avisos para o admin (não para os clientes): hoje, o consumo do provedor
-- das buscas de Google Maps, Instagram e LinkedIn chegando perto do limite
-- do mês, ou a busca parando por causa dele. Aparecem no topo das telas
-- para quem é admin e vão por e-mail (remetente da plataforma).
--
-- `chave` única evita repetir o mesmo aviso (ex.: "apify:80:2026-10-02",
-- uma vez por faixa e por ciclo de cobrança). Leitura e escrita só pelo
-- servidor (service role).
-- ============================================================

create table if not exists alertas_admin (
    id            bigserial primary key,
    chave         text not null unique,
    nivel         text not null default 'aviso' check (nivel in ('aviso', 'critico')),
    titulo        text not null,
    mensagem      text not null,
    link          text,
    criado_em     timestamptz not null default now(),
    resolvido_em  timestamptz
);

create index if not exists alertas_admin_abertos_idx on alertas_admin (criado_em desc) where resolvido_em is null;

alter table alertas_admin enable row level security;
revoke all on alertas_admin from anon, authenticated;
