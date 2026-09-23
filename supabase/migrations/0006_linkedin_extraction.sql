-- ============================================================
-- LinkedIn — novo canal de extração (Fase 1 do plano de novas
-- funcionalidades, pós-reconstrução). Busca por pessoas/decisores
-- (estilo Sales Navigator: cargo, localização, palavra-chave) via
-- Apify, reaproveitando a MESMA chave/pool Apify já usada pelo
-- Instagram e pelo fallback do Maps (resolverChaveApify).
--
-- Créditos em saldo PRÓPRIO (linkedin_credits), separado do
-- instagram_credits: o custo por resultado no Apify varia bastante
-- entre atores, misturar os dois saldos bagunçaria a precificação.
--
-- Desativado por padrão (linkedin_visible=false) — mesmo padrão do
-- Enriquecimento via IA (não do Instagram, que nasceu sempre visível):
-- é uma feature nova sendo lançada aos poucos, o admin libera por
-- usuário depois de configurar/validar a chave Apify.
--
-- Incerteza herdada (documentar, não esconder — mesmo espírito da
-- seção 5.4 do plano original sobre CNAE secundário): o schema exato
-- de input/output do ator Apify usado (harvestapi/linkedin-profile-search)
-- não pôde ser 100% verificado nesta sessão (acesso a apify.com
-- bloqueado no sandbox) — ver comentário no topo de
-- src/lib/integrations/linkedin.ts.
-- ============================================================

alter table profiles add column if not exists linkedin_credits         integer not null default 0;
alter table profiles add column if not exists monthly_linkedin_credits integer not null default 0;
alter table profiles add column if not exists linkedin_credits_enabled boolean not null default false;
alter table profiles add column if not exists linkedin_visible         boolean not null default false;

-- ── Débito atômico: agora aceita linkedin_credits também ─────────
create or replace function decrement_credits(
    p_user_id uuid,
    p_campo   text,
    p_delta   integer
) returns void
language plpgsql security definer as $$
begin
    if p_campo not in ('cdd_credits', 'maps_credits', 'instagram_credits', 'linkedin_credits') then
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

-- ── searches: aceitar fonte 'linkedin' ────────────────────────────
alter table searches drop constraint if exists searches_fonte_check;
alter table searches add constraint searches_fonte_check
    check (fonte in ('cnpj', 'google_maps', 'instagram', 'linkedin'));

-- ── leads: campos de LinkedIn ─────────────────────────────────────
alter table leads add column if not exists linkedin_url  text;
alter table leads add column if not exists cargo         text;
alter table leads add column if not exists empresa_atual text;
alter table leads add column if not exists senioridade   text;

-- ── Recria user_stats com os campos novos ────────────────────────
create or replace view user_stats as
select
    p.id, p.email, p.role,
    p.cdd_credits, p.monthly_cdd_credits,
    p.maps_credits, p.monthly_maps_credits, p.maps_credits_enabled,
    p.credits_renewed_at, p.created_at,
    count(distinct s.id) as total_searches,
    count(distinct l.id) as total_leads,
    max(s.created_at)    as last_search_at,
    p.instagram_credits, p.monthly_instagram_credits, p.instagram_credits_enabled,
    p.instagram_visible, p.disparo_habilitado, p.conta_teste, p.teste_expira_em,
    p.enriquecimento_ia_habilitado,
    p.linkedin_credits, p.monthly_linkedin_credits, p.linkedin_credits_enabled,
    p.linkedin_visible
from profiles p
left join searches s on s.user_id = p.id
left join leads    l on l.user_id = p.id
group by p.id, p.email, p.role, p.cdd_credits, p.monthly_cdd_credits,
         p.maps_credits, p.monthly_maps_credits, p.maps_credits_enabled,
         p.credits_renewed_at, p.created_at,
         p.instagram_credits, p.monthly_instagram_credits, p.instagram_credits_enabled,
         p.instagram_visible, p.disparo_habilitado, p.conta_teste, p.teste_expira_em,
         p.enriquecimento_ia_habilitado,
         p.linkedin_credits, p.monthly_linkedin_credits, p.linkedin_credits_enabled,
         p.linkedin_visible;
