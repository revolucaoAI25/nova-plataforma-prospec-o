-- ============================================================
-- Falha de segurança real, existente desde 0001_init.sql: a policy
-- "own_profile_update" (update using auth.uid() = id) não restringe
-- COLUNAS. Como a chave anon do Supabase é pública (vai pro navegador),
-- qualquer usuário logado podia chamar a REST API direto e fazer
-- `update profiles set role = 'admin', creditos = 999999999` no próprio
-- perfil — virar admin, se dar créditos infinitos, ligar qualquer recurso
-- pago. Do mesmo jeito, funções `security definer` ficam executáveis por
-- `authenticated` por padrão: `rpc('increment_creditos', …)` creditava
-- qualquer valor em qualquer conta.
--
-- Correção:
--   1. Trigger BEFORE UPDATE em profiles: pra um usuário comum
--      (role 'authenticated', não-admin), só `openai_api_key`,
--      `google_sheets_creds` e `updated_at` podem mudar. Service role
--      (rotas de servidor com cliente admin, webhooks, worker) e admins
--      continuam livres. RLS continua decidindo QUAIS linhas; o trigger
--      decide QUAIS colunas.
--   2. decrement_creditos (chamado com a sessão do usuário nas buscas)
--      só debita a própria conta e libera o trigger só durante o UPDATE.
--   3. Funções que CREDITAM saldo deixam de ser executáveis por
--      anon/authenticated — só o service role (webhook) chama.
--   4. decrement_credits (pools antigos por tipo, sem uso desde 0013)
--      é removida.
-- ============================================================

create or replace function proteger_campos_profile()
returns trigger
language plpgsql as $$
declare
    campos_livres text[] := array['openai_api_key', 'google_sheets_creds', 'updated_at'];
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

drop trigger if exists proteger_campos_profile on profiles;
create trigger proteger_campos_profile
    before update on profiles
    for each row execute function proteger_campos_profile();

create or replace function decrement_creditos(
    p_user_id uuid,
    p_delta   integer
) returns void
language plpgsql security definer as $$
begin
    if p_delta <= 0 then
        return;
    end if;
    if coalesce(auth.role(), '') = 'authenticated'
       and p_user_id is distinct from auth.uid()
       and not is_admin(auth.uid()) then
        raise exception 'Não autorizado.' using errcode = '42501';
    end if;

    perform set_config('app.liberar_profile', 'on', true);
    update profiles set creditos = greatest(0, creditos - p_delta) where id = p_user_id;
    perform set_config('app.liberar_profile', 'off', true);
end;
$$;

revoke execute on function increment_creditos(uuid, integer) from public, anon, authenticated;
revoke execute on function marcar_compra_paga_e_creditar(text) from public, anon, authenticated;
revoke execute on function registrar_pagamento_assinatura_e_creditar(uuid, uuid, text, text, integer, integer) from public, anon, authenticated;
grant execute on function increment_creditos(uuid, integer) to service_role;
grant execute on function marcar_compra_paga_e_creditar(text) to service_role;
grant execute on function registrar_pagamento_assinatura_e_creditar(uuid, uuid, text, text, integer, integer) to service_role;

drop function if exists decrement_credits(uuid, text, integer);
