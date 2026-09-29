-- ============================================================
-- Funil (Kanban) — visão de pipeline sobre leads já extraídos, integrada
-- com o construtor de fluxos nas duas direções:
--
-- 1. Fluxo → Funil: um novo nó `destino_funil` deposita o lote de leads
--    de um fluxo numa coluna de um funil (mesma família dos nós
--    `destino_sheets`/`disparo_*`).
-- 2. Funil → Fluxo: mover um card MANUALMENTE (arrastar) pra uma coluna
--    que tem `fluxo_id` configurado dispara aquele fluxo pra esse lead
--    (via `criarRunDoFluxo`, reaproveitando o motor de execução — não é
--    um mecanismo novo). Só o arraste manual dispara — um nó
--    `destino_funil` inserindo cards numa coluna com fluxo configurado
--    NÃO dispara de novo (evita loop: fluxo A deposita na coluna X,
--    coluna X dispara fluxo B, fluxo B deposita de volta na coluna X...).
--
-- `lead_snapshot` guarda os campos do lead no momento em que o card foi
-- criado — o card sobrevive mesmo se o lead original em `leads` for
-- apagado (`lead_id` vira null via `on delete set null`), porque o board
-- é sobre acompanhar contato com uma pessoa/empresa, não uma referência
-- viva ao registro de extração.
-- ============================================================

create table if not exists funis (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null references auth.users(id) on delete cascade,
    nome        text not null,
    criado_em   timestamptz not null default now()
);

create table if not exists funil_colunas (
    id          uuid primary key default gen_random_uuid(),
    funil_id    uuid not null references funis(id) on delete cascade,
    nome        text not null,
    ordem       integer not null default 0,
    cor         text,
    -- Fluxo disparado quando um card entra aqui via ARRASTE MANUAL (ver
    -- nota acima) — null significa "essa coluna não dispara nada".
    fluxo_id    uuid references automation_flows(id) on delete set null,
    criado_em   timestamptz not null default now()
);

create table if not exists funil_cards (
    id              uuid primary key default gen_random_uuid(),
    funil_id        uuid not null references funis(id) on delete cascade,
    coluna_id       uuid not null references funil_colunas(id) on delete cascade,
    user_id         uuid not null references auth.users(id) on delete cascade,
    lead_id         uuid references leads(id) on delete set null,
    lead_snapshot   jsonb not null,
    ordem           integer not null default 0,
    criado_em       timestamptz not null default now(),
    atualizado_em   timestamptz not null default now()
);

create index if not exists idx_funis_user               on funis(user_id);
create index if not exists idx_funil_colunas_funil       on funil_colunas(funil_id, ordem);
create index if not exists idx_funil_cards_coluna        on funil_cards(coluna_id, ordem);
create index if not exists idx_funil_cards_funil         on funil_cards(funil_id);

alter table funis         enable row level security;
alter table funil_colunas enable row level security;
alter table funil_cards   enable row level security;

drop policy if exists "own_or_admin_funis" on funis;
create policy "own_or_admin_funis" on funis
    for all using (user_id = auth.uid() or is_admin(auth.uid()));

drop policy if exists "own_or_admin_funil_colunas" on funil_colunas;
create policy "own_or_admin_funil_colunas" on funil_colunas
    for all using (
        exists (select 1 from funis f where f.id = funil_colunas.funil_id and (f.user_id = auth.uid() or is_admin(auth.uid())))
    );

drop policy if exists "own_or_admin_funil_cards" on funil_cards;
create policy "own_or_admin_funil_cards" on funil_cards
    for all using (user_id = auth.uid() or is_admin(auth.uid()));
