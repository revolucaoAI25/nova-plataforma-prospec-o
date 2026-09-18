-- ============================================================
-- Adiciona a coluna que faltava para o modo "chave administrada
-- individualmente" do Google Maps (paralelo ao que já existia para
-- Apify em apify_api_key_admin, 0002_full_platform.sql). Usada quando
-- maps_credits_enabled = true e a conta não tem chave própria nem pool
-- próprio: o admin grava aqui a chave única a usar para esse usuário
-- (ver src/lib/maps-key.ts, resolverChaveMaps).
-- ============================================================

alter table profiles add column if not exists maps_api_key_admin text;
