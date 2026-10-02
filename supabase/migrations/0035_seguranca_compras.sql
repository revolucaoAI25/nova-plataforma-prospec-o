-- ============================================================
-- Segurança: compras, registros de envio e domínios só gravados pelo servidor; canal da campanha do mesmo dono.
--
-- A policy own_insert_credit_purchases (0017) deixava o próprio usuário
-- inserir linhas em credit_purchases direto pela API do Supabase, com
-- qualquer quantidade de créditos. Combinada com o vínculo da cobrança
-- (asaas_payment_id), isso permitia pagar um pacote barato e receber o
-- crédito de uma "compra" forjada. A rota /api/creditos/comprar passa a
-- gravar com o service role, e o webhook confere valor e referência da
-- cobrança antes de creditar.
-- ============================================================

drop policy if exists own_insert_credit_purchases on credit_purchases;

-- ============================================================
-- Registros de envio (WhatsApp, e-mail e LinkedIn): só leitura para o
-- dono. Quem escreve é o worker e os webhooks, com o service role. Com a
-- policy ALL, o usuário podia apagar o próprio histórico pela API do
-- Supabase e zerar a contagem do dia (cota diária de e-mail do plano e
-- limites por remetente/instância/conta).
-- ============================================================

drop policy if exists own_or_admin_dispatch_messages_log on dispatch_messages_log;
create policy own_or_admin_dispatch_messages_log on dispatch_messages_log
    for select using (
        exists (select 1 from dispatch_campaigns dc where dc.id = dispatch_messages_log.campaign_id and dc.user_id = auth.uid())
        or is_admin(auth.uid())
    );

drop policy if exists own_or_admin_email_messages_log on email_messages_log;
create policy own_or_admin_email_messages_log on email_messages_log
    for select using (
        exists (select 1 from email_campaigns ec where ec.id = email_messages_log.campaign_id and ec.user_id = auth.uid())
        or is_admin(auth.uid())
    );

drop policy if exists own_or_admin_linkedin_messages_log on linkedin_messages_log;
create policy own_or_admin_linkedin_messages_log on linkedin_messages_log
    for select using (
        exists (select 1 from linkedin_campaigns lc where lc.id = linkedin_messages_log.campaign_id and lc.user_id = auth.uid())
        or is_admin(auth.uid())
    );

-- ============================================================
-- Domínios de e-mail: só leitura para o dono. Com a policy ALL, o usuário
-- podia gravar um domínio já como "verified" direto pela API do Supabase
-- e enviar e-mails com ele pela conta Resend da plataforma (que é
-- compartilhada e tem domínios verificados de outros clientes). As rotas
-- /api/email-dispatch/domains passam a gravar com o service role, e o
-- worker confere o domínio verificado do dono da campanha a cada envio.
-- ============================================================

drop policy if exists own_or_admin_email_domains on email_domains;
create policy own_or_admin_email_domains on email_domains
    for select using (user_id = auth.uid() or is_admin(auth.uid()));
drop policy if exists admin_escreve_email_domains on email_domains;
create policy admin_escreve_email_domains on email_domains
    for all using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

-- ============================================================
-- Canal da campanha precisa ser do mesmo dono da campanha. O RLS só olha
-- a linha da campanha, então dava para apontar uma campanha para o número
-- de WhatsApp, a conta de LinkedIn ou o remetente de e-mail de outra conta
-- (sabendo o id) e o worker enviaria por ele.
-- ============================================================

create or replace function conferir_dono_canal_campanha()
returns trigger
language plpgsql as $$
declare
    v_dono uuid;
begin
    if tg_table_name = 'dispatch_campaigns' and new.instance_id is not null then
        select user_id into v_dono from whatsapp_instances where id = new.instance_id;
    elsif tg_table_name = 'email_campaigns' and new.sender_id is not null then
        select user_id into v_dono from email_senders where id = new.sender_id;
    elsif tg_table_name = 'linkedin_campaigns' and new.account_id is not null then
        select user_id into v_dono from linkedin_accounts where id = new.account_id;
    else
        return new;
    end if;

    if v_dono is distinct from new.user_id then
        raise exception 'O canal escolhido não pertence a esta conta.' using errcode = '42501';
    end if;
    return new;
end;
$$;

drop trigger if exists conferir_dono_canal on dispatch_campaigns;
create trigger conferir_dono_canal before insert or update on dispatch_campaigns
    for each row execute function conferir_dono_canal_campanha();

drop trigger if exists conferir_dono_canal on email_campaigns;
create trigger conferir_dono_canal before insert or update on email_campaigns
    for each row execute function conferir_dono_canal_campanha();

drop trigger if exists conferir_dono_canal on linkedin_campaigns;
create trigger conferir_dono_canal before insert or update on linkedin_campaigns
    for each row execute function conferir_dono_canal_campanha();
