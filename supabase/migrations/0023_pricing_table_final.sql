-- ============================================================
-- Tabela de preços final alinhada com o usuário (planos + pacotes
-- avulsos) — substitui os valores de placeholder semeados em
-- 0018_asaas_subscriptions.sql (planos) e 0017_asaas_credit_purchases.sql
-- (pacotes avulsos). UPDATE em vez de INSERT: preserva os ids já
-- referenciados por profiles.plano_id / credit_purchases.package_id.
--
-- Recursos por plano: os 3 planos liberam os mesmos recursos "base"
-- (busca CNPJ/Maps/Instagram/LinkedIn, BigDataCorp, Enriquecimento via
-- IA — BYOK, WhatsApp via Evolution sem cota, e-mail via Resend, compra
-- de créditos avulsos) — só o módulo de disparo por LinkedIn (Unipile)
-- é exclusivo do Business por padrão (Starter/Pro tratam isso como
-- add-on pago à parte, cobrado manualmente pelo admin fora desta v1 —
-- ver README, não existe ainda um mecanismo de add-on pago avulso por
-- recurso). O canal oficial de WhatsApp (Datafy) já é 100% provisionado
-- manualmente pelo admin (fluxo de aprovação em /disparo/solicitar-oficial,
-- gate único é disparo_habilitado) — "add-on só no Starter" nesse caso é
-- uma decisão operacional na hora de aprovar a solicitação, não uma
-- coluna nova.
-- ============================================================

update plans set
    creditos_mensais = 6000,
    preco_centavos = 12700,
    disparo_habilitado = true,
    instagram_visible = true,
    linkedin_visible = true,
    enriquecimento_ia_habilitado = true,
    bigdatacorp_enrichment_habilitado = true,
    email_disparo_habilitado = true,
    linkedin_disparo_habilitado = false,
    descricao = 'Todos os canais de busca, WhatsApp e e-mail inclusos. Disparo por LinkedIn e canal oficial de WhatsApp como add-on à parte.'
where nome = 'Starter';

update plans set
    creditos_mensais = 30000,
    preco_centavos = 34700,
    disparo_habilitado = true,
    instagram_visible = true,
    linkedin_visible = true,
    enriquecimento_ia_habilitado = true,
    bigdatacorp_enrichment_habilitado = true,
    email_disparo_habilitado = true,
    linkedin_disparo_habilitado = false,
    descricao = 'Tudo do Starter, cota maior de e-mail e canal oficial de WhatsApp incluso. Disparo por LinkedIn como add-on à parte.'
where nome = 'Pro';

update plans set
    creditos_mensais = 100000,
    preco_centavos = 89700,
    disparo_habilitado = true,
    instagram_visible = true,
    linkedin_visible = true,
    enriquecimento_ia_habilitado = true,
    bigdatacorp_enrichment_habilitado = true,
    email_disparo_habilitado = true,
    linkedin_disparo_habilitado = true,
    descricao = 'Tudo incluso — maior cota de e-mail, canal oficial de WhatsApp e disparo por LinkedIn sem custo extra.'
where nome = 'Business';

update credit_packages set nome = 'P', quantidade_creditos = 2000,  preco_centavos = 4700  where ordem = 1;
update credit_packages set nome = 'M', quantidade_creditos = 10000, preco_centavos = 19700 where ordem = 2;
update credit_packages set nome = 'G', quantidade_creditos = 50000, preco_centavos = 79700 where ordem = 3;
