-- ════════════════════════════════════════════════════════════════════
-- 0037 — Corrige a conferência de dono do canal da campanha (0035)
--
-- A função de 0035 lia `new.instance_id`, `new.sender_id` e
-- `new.account_id` na mesma cadeia de if/elsif. O PL/pgSQL não para de
-- avaliar no primeiro `and` falso: ao chegar num campo que a tabela não tem,
-- dá erro ("record new has no field ..."). Resultado: criar ou editar
-- campanha de e-mail e de LinkedIn falhava sempre, e de WhatsApp falhava
-- quando a campanha ainda não tinha número escolhido.
--
-- Agora o campo é lido do JSON da linha, que aceita qualquer nome.
-- ════════════════════════════════════════════════════════════════════

create or replace function conferir_dono_canal_campanha()
returns trigger
language plpgsql as $$
declare
    v_linha jsonb := to_jsonb(new);
    v_canal uuid;
    v_dono uuid;
begin
    if tg_table_name = 'dispatch_campaigns' then
        v_canal := (v_linha->>'instance_id')::uuid;
        if v_canal is null then return new; end if;
        select user_id into v_dono from whatsapp_instances where id = v_canal;
    elsif tg_table_name = 'email_campaigns' then
        v_canal := (v_linha->>'sender_id')::uuid;
        if v_canal is null then return new; end if;
        select user_id into v_dono from email_senders where id = v_canal;
    elsif tg_table_name = 'linkedin_campaigns' then
        v_canal := (v_linha->>'account_id')::uuid;
        if v_canal is null then return new; end if;
        select user_id into v_dono from linkedin_accounts where id = v_canal;
    else
        return new;
    end if;

    if v_dono is distinct from new.user_id then
        raise exception 'O canal escolhido não pertence a esta conta.' using errcode = '42501';
    end if;
    return new;
end;
$$;
