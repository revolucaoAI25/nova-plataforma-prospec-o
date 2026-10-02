-- ════════════════════════════════════════════════════════════════════
-- 0033 — Dados do cliente no perfil (nome, telefone, empresa)
--
-- 1. profiles ganha nome, telefone (E.164 sem "+") e empresa. O admin
--    preenche ao criar a conta; o próprio cliente pode corrigir em
--    "Meu perfil" — por isso as três colunas entram na lista de campos
--    livres do trigger proteger_campos_profile (0028). O resto do perfil
--    continua travado pra usuário comum.
-- 2. user_stats expõe as três colunas pro painel admin (no fim do select:
--    `create or replace view` só aceita colunas novas depois das antigas).
-- 3. handle_new_user (0001) deixa de ler o papel do user_metadata. Esse
--    campo é preenchido por quem se cadastra (auth.signUp com a chave anon,
--    que é pública): se o cadastro aberto estiver ligado no Supabase,
--    qualquer um criava uma conta já como admin. Agora todo perfil nasce
--    'user' e o papel é definido só pelo servidor (rota admin, service role).
-- ════════════════════════════════════════════════════════════════════

alter table profiles
    add column if not exists nome     text,
    add column if not exists telefone text,
    add column if not exists empresa  text;

create or replace function proteger_campos_profile()
returns trigger
language plpgsql as $$
declare
    campos_livres text[] := array[
        'openai_api_key', 'google_sheets_creds', 'updated_at',
        'nome', 'telefone', 'empresa'
    ];
begin
    if coalesce(auth.role(), '') <> 'authenticated'
       or current_setting('app.liberar_profile', true) = 'on'
       or is_admin(auth.uid()) then
        return new;
    end if;

    if (to_jsonb(new) - campos_livres) is distinct from (to_jsonb(old) - campos_livres) then
        raise exception 'Este campo do perfil só pode ser alterado pela plataforma.' using errcode = '42501';
    end if;
    return new;
end;
$$;

create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
    insert into profiles (id, email, role)
    values (new.id, new.email, 'user')
    on conflict (id) do nothing;
    return new;
end;
$$;

create or replace view user_stats as
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
    p.creditos, p.monthly_creditos,
    p.nome, p.telefone, p.empresa
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
         p.creditos, p.monthly_creditos,
         p.nome, p.telefone, p.empresa;

revoke all on user_stats from anon, authenticated;
grant select on user_stats to service_role;
