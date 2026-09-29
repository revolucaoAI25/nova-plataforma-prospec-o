-- ============================================================
-- Bundle de features por plano — pedido explícito: "uma vez que a
-- assinatura for atrelada ela já pode ter todas as permissões daquela
-- conta". Reverte a decisão de 0018 (documentada como "fora de escopo da
-- v1"), que deixava plans puramente sobre créditos mensais.
--
-- Mesmas 7 colunas booleanas que já existem em `profiles` (editáveis
-- manualmente pelo admin desde antes) — replicadas aqui em `plans` como
-- "o que esse plano concede". A aplicação em si (profile ganha os flags
-- do plano) acontece em `subscriptions-db.ts::processarPagamentoAssinatura`,
-- só na PRIMEIRA ativação de cada assinatura (não a cada renovação
-- mensal) e sempre por OR — nunca REMOVE um flag que o admin já tinha
-- concedido manualmente antes, só adiciona. Cancelar a assinatura
-- também NÃO revoga os flags automaticamente (mesma cautela: tirar
-- acesso de forma automática tem efeito colateral maior que conceder a
-- mais — ex: campanha de disparo ativa que passaria a falhar sozinha).
-- Revogar continua sendo uma ação manual do admin, como já era.
-- ============================================================

alter table plans add column if not exists disparo_habilitado boolean not null default false;
alter table plans add column if not exists instagram_visible boolean not null default false;
alter table plans add column if not exists linkedin_visible boolean not null default false;
alter table plans add column if not exists enriquecimento_ia_habilitado boolean not null default false;
alter table plans add column if not exists bigdatacorp_enrichment_habilitado boolean not null default false;
alter table plans add column if not exists email_disparo_habilitado boolean not null default false;
alter table plans add column if not exists linkedin_disparo_habilitado boolean not null default false;

-- Defaults sugeridos pros 3 planos semeados em 0018 — o admin pode
-- reconfigurar cada um livremente em /admin, isto é só um ponto de
-- partida razoável (Starter: canais de busca; Pro: + enriquecimento e
-- e-mail; Business: tudo, inclusive o canal mais caro/arriscado, LinkedIn).
update plans set disparo_habilitado = true, instagram_visible = true, linkedin_visible = true
  where nome = 'Starter';
update plans set disparo_habilitado = true, instagram_visible = true, linkedin_visible = true,
  enriquecimento_ia_habilitado = true, bigdatacorp_enrichment_habilitado = true, email_disparo_habilitado = true
  where nome = 'Pro';
update plans set disparo_habilitado = true, instagram_visible = true, linkedin_visible = true,
  enriquecimento_ia_habilitado = true, bigdatacorp_enrichment_habilitado = true, email_disparo_habilitado = true,
  linkedin_disparo_habilitado = true
  where nome = 'Business';
