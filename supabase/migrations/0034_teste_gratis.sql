-- ============================================================
-- Teste grátis (autoatendimento, pela página de vendas).
--
-- Diferente de `conta_teste` (conta de demonstração criada pelo admin,
-- com quase tudo liberado): o teste grátis nasce no cadastro público
-- /teste-gratis, recebe poucos créditos e só pode extrair empresas por
-- CNPJ e Google Maps. Disparos, funil, automações, enriquecimento e a
-- estratégia por IA ficam bloqueados até a pessoa assinar um plano.
--
-- O bloqueio vale enquanto teste_gratis = true e a assinatura não está
-- ativa; ao confirmar o 1º pagamento, o webhook desliga a coluna.
-- A coluna fica protegida contra escrita do próprio usuário pelo trigger
-- proteger_campos_profile (0028), que bloqueia tudo fora da lista livre.
-- ============================================================

alter table profiles add column if not exists teste_gratis boolean not null default false;

-- Um teste por WhatsApp: o cadastro procura o telefone antes de criar a conta.
create index if not exists profiles_telefone_idx on profiles (telefone);

-- user_stats ganha a coluna no fim (create or replace view só aceita
-- colunas novas depois das existentes; definição anterior em 0033).
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
    p.nome, p.telefone, p.empresa,
    p.teste_gratis
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
         p.nome, p.telefone, p.empresa,
         p.teste_gratis;

revoke all on user_stats from anon, authenticated;
grant select on user_stats to service_role;
