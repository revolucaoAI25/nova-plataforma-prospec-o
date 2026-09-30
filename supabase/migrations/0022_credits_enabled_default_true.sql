-- ============================================================
-- Bug real encontrado pelo usuário: maps_credits_enabled/
-- instagram_credits_enabled/linkedin_credits_enabled nasceram com
-- `default false` lá em 0001/0002/0006, de uma época em que "false"
-- significava "usuário ainda não configurou billing, use a própria
-- chave". Depois da unificação em pool único de créditos (0013), o
-- sentido inverteu: hoje `false` é o caso especial (usuário traz a
-- própria chave e por isso NÃO é cobrado), e `true` deveria ser o
-- padrão (busca cobrada do pool de créditos, usando a chave/pool
-- administrado pela plataforma) — mas o default da coluna nunca foi
-- atualizado. Efeito prático, confirmado lendo o código:
--   1. Toda busca avulsa Maps/Instagram/LinkedIn (src/app/api/search/{maps,
--      instagram,linkedin}/route.ts) só debita créditos
--      `if (profile.maps_credits_enabled)` (idem instagram/linkedin) — com
--      o default em false, a busca RODA (cai no fallback de chave
--      administrada/env) mas NUNCA cobra créditos. Vazamento de custo real:
--      a plataforma paga a Apify, o usuário não paga nada em créditos.
--   2. src/app/(app)/busca/maps/page.tsx só mostra o indicador de créditos
--      quando `maps_credits_enabled` é true — daí o usuário não ver NENHUMA
--      referência de custo na busca Maps (CreditoEstimado retorna null
--      pra custo 0).
--   3. src/components/settings/maps-settings.tsx só esconde os campos de
--      "configure sua própria chave" quando `maps_credits_enabled` é
--      true — com o default em false, todo usuário novo vê esses campos
--      (Apify não tem nem essa checagem — ver ApifySettings.tsx, corrigido
--      separadamente pra deixar a seção claramente opcional).
--
-- Corrige o default pra true e faz backfill de quem ainda está no default
-- antigo (contas de teste sempre usam a chave/pool de teste, então não são
-- afetadas por este flag de qualquer forma — mas ficam de fora do
-- backfill por clareza).
-- ============================================================

alter table profiles alter column maps_credits_enabled set default true;
alter table profiles alter column instagram_credits_enabled set default true;
alter table profiles alter column linkedin_credits_enabled set default true;

update profiles set maps_credits_enabled = true
  where maps_credits_enabled = false and conta_teste = false;
update profiles set instagram_credits_enabled = true
  where instagram_credits_enabled = false and conta_teste = false;
update profiles set linkedin_credits_enabled = true
  where linkedin_credits_enabled = false and conta_teste = false;
