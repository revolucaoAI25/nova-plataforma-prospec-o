-- ════════════════════════════════════════════════════════════════════
-- 0032 — Ritmo de envio, teste A/B e status de entrega/leitura
--
-- 1. Ritmo (campanhas de WhatsApp, e-mail e LinkedIn):
--    - limite_novos_por_dia: quantos leads NOVOS (primeiro toque) a
--      campanha aborda por dia. Follow-up de quem já está na cadência não
--      conta. Nulo = sem limite. É o que deixa jogar 500 leads numa
--      campanha e ela "pingar" 40 por dia.
--    - janela_inicio / janela_fim / janela_dias: horário e dias (ISO, 1 =
--      segunda … 7 = domingo) em que a campanha envia, no fuso de
--      America/Sao_Paulo. Padrão: dias úteis, 8h às 19h — campanhas
--      existentes passam a respeitar isso (nada de mensagem de madrugada).
--    - Alvo ganha primeiro_envio_em (quando recebeu o 1º toque) pra contar
--      os novos do dia.
--    As regras entram nas funções de claim: o worker simplesmente não
--    recebe alvo fora da janela ou além do limite.
--
-- 2. Teste A/B: cada etapa pode ter uma variante B (texto, assunto, nota).
--    O alvo sorteia A ou B ao entrar na campanha e recebe sempre a mesma
--    variante; o log guarda qual foi, pros relatórios compararem.
--
-- 3. Status de entrega/leitura nos logs de envio (entregue_em, lido_em; no
--    e-mail também clique, devolução e reclamação), alimentados pelos
--    webhooks de cada canal. As instâncias de WhatsApp voltam a registrar
--    o webhook (agora também com MESSAGES_UPDATE, que traz entregue/lido).
-- ════════════════════════════════════════════════════════════════════

-- ── Funções de apoio ──────────────────────────────────────────────

create or replace function inicio_do_dia_sp() returns timestamptz
language sql stable as $$
    select date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo';
$$;

create or replace function dentro_da_janela(p_inicio time, p_fim time, p_dias int[]) returns boolean
language sql stable as $$
    select
        (p_dias is null or cardinality(p_dias) = 0
            or extract(isodow from now() at time zone 'America/Sao_Paulo')::int = any(p_dias))
        and (p_inicio is null or (now() at time zone 'America/Sao_Paulo')::time >= p_inicio)
        and (p_fim is null or (now() at time zone 'America/Sao_Paulo')::time < p_fim);
$$;

-- ── Colunas ───────────────────────────────────────────────────────

do $$
declare
    t text;
begin
    foreach t in array array['dispatch_campaigns', 'email_campaigns', 'linkedin_campaigns'] loop
        execute format('alter table %I add column if not exists limite_novos_por_dia integer check (limite_novos_por_dia is null or limite_novos_por_dia > 0)', t);
        execute format('alter table %I add column if not exists janela_inicio time default ''08:00''', t);
        execute format('alter table %I add column if not exists janela_fim time default ''19:00''', t);
        execute format('alter table %I add column if not exists janela_dias int[] default ''{1,2,3,4,5}''', t);
    end loop;

    foreach t in array array['dispatch_targets', 'email_targets', 'linkedin_targets'] loop
        execute format('alter table %I add column if not exists primeiro_envio_em timestamptz', t);
        execute format('alter table %I add column if not exists variante text not null default ''A'' check (variante in (''A'', ''B''))', t);
        execute format('create index if not exists %I on %I (campaign_id, primeiro_envio_em)', 'idx_' || t || '_primeiro_envio', t);
    end loop;

    foreach t in array array['dispatch_messages_log', 'email_messages_log', 'linkedin_messages_log'] loop
        execute format('alter table %I add column if not exists variante text', t);
        execute format('alter table %I add column if not exists entregue_em timestamptz', t);
        execute format('alter table %I add column if not exists lido_em timestamptz', t);
    end loop;
end $$;

alter table dispatch_cadence_steps add column if not exists corpo_mensagem_b text;
alter table email_cadence_steps    add column if not exists assunto_b text;
alter table email_cadence_steps    add column if not exists corpo_b text;
alter table linkedin_cadence_steps add column if not exists nota_b text;
alter table linkedin_cadence_steps add column if not exists corpo_b text;

alter table email_messages_log add column if not exists clicado_em timestamptz;
alter table email_messages_log add column if not exists devolvido_em timestamptz;
alter table email_messages_log add column if not exists reclamacao_em timestamptz;

-- Os webhooks localizam a mensagem pelo id do provedor.
create index if not exists idx_dispatch_log_msg_id on dispatch_messages_log(evolution_message_id);
create index if not exists idx_email_log_msg_id    on email_messages_log(provider_message_id);
create index if not exists idx_linkedin_log_ref    on linkedin_messages_log(provider_ref);

-- Re-registra o webhook das instâncias com o evento novo (entregue/lido).
update whatsapp_instances set webhook_configurado_em = null where webhook_configurado_em is not null;

-- ── Claims com janela e limite de novos ───────────────────────────

create or replace function claim_dispatch_target(p_instance_id uuid)
returns setof dispatch_targets as $$
    update dispatch_targets
    set status = 'enviando', reservado_em = now()
    where id = (
        select dt.id from dispatch_targets dt
        join dispatch_campaigns dc on dc.id = dt.campaign_id
        where dc.instance_id = p_instance_id
          and dc.status = 'ativa'
          and dt.status = 'pendente'
          and dt.proxima_etapa_em <= now()
          and dentro_da_janela(dc.janela_inicio, dc.janela_fim, dc.janela_dias)
          and (
              dt.current_step_id is not null
              or dc.limite_novos_por_dia is null
              or (select count(*) from dispatch_targets x
                  where x.campaign_id = dc.id and x.primeiro_envio_em >= inicio_do_dia_sp()) < dc.limite_novos_por_dia
          )
        order by dt.proxima_etapa_em
        limit 1
        for update of dt skip locked
    )
    returning *;
$$ language sql volatile;

create or replace function claim_linkedin_target(p_account_id uuid)
returns setof linkedin_targets as $$
    update linkedin_targets
    set status = 'enviando', reservado_em = now()
    where id = (
        select lt.id from linkedin_targets lt
        join linkedin_campaigns lc on lc.id = lt.campaign_id
        where lc.account_id = p_account_id
          and lc.status = 'ativa'
          and lt.status = 'pendente'
          and lt.proxima_etapa_em <= now()
          and dentro_da_janela(lc.janela_inicio, lc.janela_fim, lc.janela_dias)
          and (
              lt.current_step_id is not null
              or lc.limite_novos_por_dia is null
              or (select count(*) from linkedin_targets x
                  where x.campaign_id = lc.id and x.primeiro_envio_em >= inicio_do_dia_sp()) < lc.limite_novos_por_dia
          )
        order by lt.proxima_etapa_em
        limit 1
        for update of lt skip locked
    )
    returning *;
$$ language sql volatile;

-- E-mail sai em lote: follow-ups primeiro (quem já está na cadência), e no
-- máximo as vagas de "novos" que sobraram no dia.
create or replace function claim_email_targets(p_campaign_id uuid, p_limit integer default 20)
returns setof email_targets as $$
declare
    c email_campaigns;
    vagas integer;
begin
    select * into c from email_campaigns where id = p_campaign_id;
    if not found or c.status <> 'ativa' or not dentro_da_janela(c.janela_inicio, c.janela_fim, c.janela_dias) then
        return;
    end if;

    if c.limite_novos_por_dia is null then
        vagas := p_limit;
    else
        select greatest(c.limite_novos_por_dia - count(*), 0) into vagas
        from email_targets where campaign_id = p_campaign_id and primeiro_envio_em >= inicio_do_dia_sp();
    end if;

    -- FOR UPDATE não vale dentro de UNION: cada grupo trava as suas linhas
    -- numa CTE própria, e a união só escolhe quais saem neste lote.
    return query
    with followups as (
        select et.id, et.proxima_etapa_em from email_targets et
        where et.campaign_id = p_campaign_id and et.status = 'pendente'
          and et.proxima_etapa_em <= now() and et.current_step_id is not null
        order by et.proxima_etapa_em limit p_limit
        for update skip locked
    ), novos as (
        select et.id, et.proxima_etapa_em from email_targets et
        where et.campaign_id = p_campaign_id and et.status = 'pendente'
          and et.proxima_etapa_em <= now() and et.current_step_id is null
        order by et.proxima_etapa_em limit least(vagas, p_limit)
        for update skip locked
    ), escolhidos as (
        select id, proxima_etapa_em from followups
        union all
        select id, proxima_etapa_em from novos
        order by proxima_etapa_em
        limit p_limit
    )
    update email_targets
    set status = 'enviando', reservado_em = now()
    where id in (select id from escolhidos)
    returning *;
end;
$$ language plpgsql volatile;

revoke execute on function claim_dispatch_target(uuid) from anon, authenticated;
revoke execute on function claim_linkedin_target(uuid) from anon, authenticated;
revoke execute on function claim_email_targets(uuid, integer) from anon, authenticated;
