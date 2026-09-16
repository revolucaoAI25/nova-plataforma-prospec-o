-- ============================================================
-- Nova Plataforma de Prospecção · Schema inicial (Fase 0)
-- Execute no SQL Editor de um projeto Supabase NOVO (não reaproveitar
-- o projeto do produto "prospec-o-ativa" — ver plano de reconstrução).
--
-- Fase 0 cobre: perfis + créditos, busca CNPJ (Casa dos Dados), busca
-- Google Maps, histórico e exportação. Disparo, automações, Instagram
-- e onboarding multicanal ficam para as fases seguintes — as tabelas
-- abaixo já guardam `filtros` completos em JSONB (não só um resumo)
-- para permitir auditoria/replay, uma melhoria sobre o produto atual.
-- ============================================================

create extension if not exists "pgcrypto";

-- ── Perfis de usuário ──────────────────────────────────────────
-- Estende auth.users. 1 linha por usuário, criada automaticamente
-- pelo trigger handle_new_user ao cadastrar no Supabase Auth.
create table if not exists profiles (
    id                     uuid primary key references auth.users(id) on delete cascade,
    email                  text not null,
    role                   text not null default 'user' check (role in ('user', 'admin')),

    -- Créditos CNPJ (Casa dos Dados)
    cdd_credits            integer not null default 0,
    monthly_cdd_credits    integer not null default 0,

    -- Créditos Google Maps (só debitados se maps_credits_enabled = true;
    -- caso contrário o uso de Maps não consome saldo, só a chave configurada)
    maps_credits           integer not null default 0,
    monthly_maps_credits   integer not null default 0,
    maps_credits_enabled   boolean not null default false,

    credits_renewed_at     date,

    -- Credenciais próprias (modelo "auto-gerenciado"). Quando nulas, o
    -- usuário usa a chave/pool administrada pelo admin (maps_keys_pool
    -- em platform_settings, ou cdd_api_key_admin abaixo).
    cdd_api_key            text,
    google_maps_api_key    text,

    -- Chave/pool administrados pelo admin para este usuário específico
    -- (modelo "gerenciado pelo admin" — cobrado como créditos da plataforma)
    cdd_api_key_admin      text,
    maps_keys_pool         jsonb not null default '[]'::jsonb,
    maps_pausar_ao_esgotar boolean not null default false,

    created_at             timestamptz not null default now(),
    updated_at             timestamptz not null default now()
);

-- ── Pesquisas realizadas ──────────────────────────────────────
create table if not exists searches (
    id            uuid primary key default gen_random_uuid(),
    user_id       uuid not null references auth.users(id) on delete cascade,
    fonte         text not null check (fonte in ('cnpj', 'google_maps')),
    nicho         text,
    subnicho      text,
    cidade        text,
    estado        text,
    localidade    text,
    total_results integer not null default 0,
    -- Filtros completos usados na busca (não só um resumo) — permite
    -- auditoria e "repetir esta busca" no futuro. Ver seção 5.3 do plano.
    filtros       jsonb not null default '{}'::jsonb,
    created_at    timestamptz not null default now()
);

-- ── Leads extraídos ───────────────────────────────────────────
-- Superconjunto dos campos que CNPJ (Casa dos Dados) e Google Maps podem
-- preencher — cada busca só popula os campos que sua fonte retorna.
create table if not exists leads (
    id                     uuid primary key default gen_random_uuid(),
    user_id                uuid not null references auth.users(id) on delete cascade,
    search_id              uuid not null references searches(id) on delete cascade,

    nome                   text,
    telefone               text,
    telefone2              text,
    telefone_internacional text,
    tipo_telefone          text,
    email                  text,
    endereco               text,
    municipio              text,
    uf                     text,
    cep                    text,
    site                   text,
    maps_url               text,
    avaliacao              real,
    total_avaliacoes       integer,
    status_funcionamento   text,

    cnpj                   text,
    cnae_codigo            text,
    matriz_filial          text,
    natureza_juridica      text,
    data_abertura          text,
    capital_social         text,
    simples_optante        text,
    mei_optante            text,
    situacao_especial      text,
    socio_principal        text,
    porte                  text,

    nicho                  text,
    subnicho               text,
    cidade_busca           text,
    estado_busca           text,
    comentario             text,
    fonte                  text,

    created_at             timestamptz not null default now()
);

-- ── Índices ────────────────────────────────────────────────────
create index if not exists idx_searches_user_id ON searches(user_id);
create index if not exists idx_searches_created ON searches(created_at desc);
create index if not exists idx_leads_search_id  ON leads(search_id);
create index if not exists idx_leads_user_id    ON leads(user_id);
-- Deduplicação por telefone/CNPJ já salvos pelo usuário (ver buscar_identificadores_existentes)
create index if not exists idx_leads_user_cnpj     ON leads(user_id, cnpj) where cnpj is not null and cnpj <> '';
create index if not exists idx_leads_user_telefone ON leads(user_id, telefone) where telefone is not null and telefone <> '';

-- ── Row Level Security ────────────────────────────────────────
alter table profiles enable row level security;
alter table searches enable row level security;
alter table leads    enable row level security;

drop policy if exists "own_profile" on profiles;
create policy "own_profile" on profiles
    for select using (auth.uid() = id);

drop policy if exists "own_profile_update" on profiles;
create policy "own_profile_update" on profiles
    for update using (auth.uid() = id);

drop policy if exists "admin_all_profiles" on profiles;
create policy "admin_all_profiles" on profiles
    for all using (
        exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
    );

drop policy if exists "own_searches" on searches;
create policy "own_searches" on searches
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "admin_all_searches" on searches;
create policy "admin_all_searches" on searches
    for all using (
        exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
    );

drop policy if exists "own_leads" on leads;
create policy "own_leads" on leads
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "admin_all_leads" on leads;
create policy "admin_all_leads" on leads
    for all using (
        exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
    );

-- ── Trigger: cria perfil automaticamente ao criar usuário ──────
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
    insert into profiles (id, email, role)
    values (new.id, new.email, coalesce(new.raw_user_meta_data->>'role', 'user'))
    on conflict (id) do nothing;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function handle_new_user();

-- ── Trigger: atualiza updated_at ────────────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists profiles_updated_at on profiles;
create trigger profiles_updated_at
    before update on profiles
    for each row execute function set_updated_at();

-- ── Débito atômico de créditos (evita race condition) ───────────
create or replace function decrement_credits(
    p_user_id uuid,
    p_campo   text,
    p_delta   integer
) returns void
language plpgsql security definer as $$
begin
    if p_campo not in ('cdd_credits', 'maps_credits') then
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

-- ── View auxiliar para o admin ver usuários com estatísticas ────
create or replace view user_stats as
select
    p.id, p.email, p.role,
    p.cdd_credits, p.monthly_cdd_credits,
    p.maps_credits, p.monthly_maps_credits, p.maps_credits_enabled,
    p.credits_renewed_at, p.created_at,
    count(distinct s.id) as total_searches,
    count(distinct l.id) as total_leads,
    max(s.created_at)    as last_search_at
from profiles p
left join searches s on s.user_id = p.id
left join leads    l on l.user_id = p.id
group by p.id, p.email, p.role, p.cdd_credits, p.monthly_cdd_credits,
         p.maps_credits, p.monthly_maps_credits, p.maps_credits_enabled,
         p.credits_renewed_at, p.created_at;
