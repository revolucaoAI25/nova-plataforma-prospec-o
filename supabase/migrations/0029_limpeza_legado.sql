-- ============================================================
-- Limpeza do que ficou sem uso depois da centralização das chaves e da
-- remoção das automações antigas, e correção de um bug real em
-- platform_settings.
--
-- 1. platform_settings: 0002_full_platform.sql já criava uma tabela com
--    esse nome (linha única, `maps_pool_teste`), então o
--    `create table if not exists` de 0019 (formato chave/valor) nunca
--    rodou — o painel "Chaves da plataforma" do /admin não conseguia ler
--    nem gravar nada, e toda integração caía sempre na variável de
--    ambiente. Aqui a tabela antiga é substituída pela chave/valor.
--
-- 2. Chaves de fornecedor por usuário (Casa dos Dados, Google Maps,
--    Apify — própria, "administrada" e pools com rodízio) saem: agora
--    são sempre da plataforma (src/lib/platform-keys.ts). Antes de
--    apagar, a primeira chave encontrada de cada fornecedor é copiada
--    pra platform_settings, pra nada parar de funcionar no deploy — o
--    admin pode trocar depois em /admin.
--
-- 3. Saem também os saldos por tipo (cdd/maps/instagram/linkedin_credits,
--    sem uso desde o pool único de 0013), os flags *_credits_enabled
--    (toda ação agora debita sempre) e o OAuth do Google por usuário
--    (google_client_id/secret — o OAuth é da plataforma desde o início
--    desta reconstrução).
--
-- 4. Automações antigas (automations/automation_runs) — substituídas
--    pelos fluxos.
-- ============================================================

-- Bancos diferentes chegaram aqui com conjuntos diferentes de colunas
-- antigas (ex.: sem maps_api_key_admin, de 0004). Por isso cada chave é
-- copiada só das colunas que existem de fato — nunca referencia coluna
-- ausente.
create or replace function pg_temp.coluna_existe(p_tabela text, p_coluna text) returns boolean
language sql stable as $f$
    select exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = p_tabela and column_name = p_coluna
    );
$f$;

-- Primeira chave não vazia entre as expressões cujas colunas existem.
create or replace function pg_temp.primeira_chave(p_candidatos text[][]) returns text
language plpgsql as $f$
declare
    i int;
    expressoes text[] := '{}';
    v text;
begin
    for i in 1 .. coalesce(array_length(p_candidatos, 1), 0) loop
        if pg_temp.coluna_existe('profiles', p_candidatos[i][1]) then
            expressoes := expressoes || format('nullif(trim(%s), %L)', p_candidatos[i][2], '');
        end if;
    end loop;
    if array_length(expressoes, 1) is null then
        return null;
    end if;
    execute format(
        'select coalesce(%1$s) from profiles where coalesce(%1$s) is not null limit 1',
        array_to_string(expressoes, ', ')
    ) into v;
    return v;
end;
$f$;

do $$
declare
    v_cdd   text;
    v_maps  text;
    v_apify text;
    tem_singleton boolean;
begin
    tem_singleton := pg_temp.coluna_existe('platform_settings', 'maps_pool_teste');

    v_cdd := pg_temp.primeira_chave(array[
        ['cdd_api_key_admin', 'cdd_api_key_admin'],
        ['cdd_api_key',       'cdd_api_key']
    ]);
    v_maps := pg_temp.primeira_chave(array[
        ['maps_keys_pool',     $e$maps_keys_pool->0->>'key'$e$],
        ['maps_api_key_admin', 'maps_api_key_admin'],
        ['google_maps_api_key', 'google_maps_api_key']
    ]);
    v_apify := pg_temp.primeira_chave(array[
        ['apify_keys_pool',     $e$apify_keys_pool->0->>'key'$e$],
        ['apify_api_key_admin', 'apify_api_key_admin'],
        ['apify_api_key',       'apify_api_key']
    ]);

    if tem_singleton then
        if v_maps is null then
            execute $q$ select nullif(maps_pool_teste->0->>'key', '') from platform_settings where id = 1 $q$ into v_maps;
        end if;
        drop table platform_settings;
    end if;

    create table if not exists platform_settings (
        chave          text primary key,
        valor          text,
        atualizado_em  timestamptz not null default now(),
        atualizado_por uuid references auth.users(id) on delete set null
    );
    alter table platform_settings enable row level security;

    if v_cdd is not null then
        insert into platform_settings (chave, valor) values ('cdd_api_key', v_cdd) on conflict (chave) do nothing;
    end if;
    if v_maps is not null then
        insert into platform_settings (chave, valor) values ('google_maps_api_key', v_maps) on conflict (chave) do nothing;
    end if;
    if v_apify is not null then
        insert into platform_settings (chave, valor) values ('apify_api_key', v_apify) on conflict (chave) do nothing;
    end if;
end $$;

drop view if exists user_stats;

alter table profiles
    drop column if exists cdd_credits,
    drop column if exists monthly_cdd_credits,
    drop column if exists maps_credits,
    drop column if exists monthly_maps_credits,
    drop column if exists maps_credits_enabled,
    drop column if exists cdd_api_key,
    drop column if exists google_maps_api_key,
    drop column if exists cdd_api_key_admin,
    drop column if exists maps_api_key_admin,
    drop column if exists maps_keys_pool,
    drop column if exists maps_pausar_ao_esgotar,
    drop column if exists apify_api_key,
    drop column if exists apify_api_key_admin,
    drop column if exists apify_keys_pool,
    drop column if exists instagram_credits,
    drop column if exists monthly_instagram_credits,
    drop column if exists instagram_credits_enabled,
    drop column if exists linkedin_credits,
    drop column if exists monthly_linkedin_credits,
    drop column if exists linkedin_credits_enabled,
    drop column if exists google_client_id,
    drop column if exists google_client_secret;

create view user_stats as
select
    p.id, p.email, p.role,
    p.credits_renewed_at, p.created_at,
    count(distinct s.id) as total_searches,
    count(distinct l.id) as total_leads,
    max(s.created_at)    as last_search_at,
    p.instagram_visible, p.disparo_habilitado, p.conta_teste, p.teste_expira_em,
    p.enriquecimento_ia_habilitado,
    p.linkedin_visible,
    p.email_disparo_habilitado,
    p.linkedin_disparo_habilitado,
    p.bigdatacorp_enrichment_habilitado,
    p.creditos, p.monthly_creditos
from profiles p
left join searches s on s.user_id = p.id
left join leads    l on l.user_id = p.id
group by p.id, p.email, p.role, p.credits_renewed_at, p.created_at,
         p.instagram_visible, p.disparo_habilitado, p.conta_teste, p.teste_expira_em,
         p.enriquecimento_ia_habilitado,
         p.linkedin_visible,
         p.email_disparo_habilitado,
         p.linkedin_disparo_habilitado,
         p.bigdatacorp_enrichment_habilitado,
         p.creditos, p.monthly_creditos;

drop table if exists automation_runs;
drop table if exists automations;

-- A view roda com o dono (ignora o RLS de profiles) e o Supabase dá
-- SELECT em views do schema public pra anon/authenticated por padrão —
-- qualquer usuário logado conseguia listar e-mail, papel e saldo de
-- todos os outros via REST. Só o servidor (painel admin, com cliente
-- service role e checagem de admin na rota) lê daqui agora.
revoke all on user_stats from anon, authenticated;
grant select on user_stats to service_role;
