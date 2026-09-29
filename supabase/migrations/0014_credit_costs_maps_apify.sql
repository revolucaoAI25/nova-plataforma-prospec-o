-- ============================================================
-- Ajustes de preço em credit_costs, depois de dois achados reais:
--
-- 1. A busca AVULSA de Maps parou de usar a API oficial do Google (que
--    tem cota grátis mensal, mas cobra caro acima dela — Text Search Pro
--    ~$32/1000, Place Details Pro ~$17-20/1000) e passa a usar só o
--    scraping via Apify (compass/crawler-google-places, ~$4/1000 lugares
--    — bem mais barato, decisão explícita do usuário). O peso de `maps`
--    já tinha sido calculado em cima do preço da Apify desde a migration
--    0013 (não precisa mudar), mas o código só foi trocado agora
--    (0013_unified_credits.sql não alterava a integração, só o schema de
--    créditos).
--
-- 2. `cnpj_maps_extra` (verificação de telefone/site via Maps embutida na
--    busca por CNPJ) CONTINUA na API oficial do Google — a Apify não dá
--    pra usar aqui: o scraper roda como um "job" assíncrono (inicia um
--    run, espera minutos, coleta resultado), enquanto essa verificação
--    faz 1 lookup específico por lead DENTRO do ciclo de uma requisição
--    HTTP síncrona (até 300 leads por busca) — trocar isso exigiria
--    reconstruir esse fluxo como assíncrono (padrão do
--    bigdatacorp-enrichment-tick.ts), o que não foi feito nesta migration.
--    O peso de 5 créditos estava calculado como se já fosse Apify —
--    corrigido aqui pro custo real da API oficial: ~1 Text Search
--    ($32/1000) + ~1 Place Details com telefone/site
--    (~$20/1000, tier com dados de contato) por lead verificado ≈
--    $0,052/lead ≈ R$0,29/lead (R$5,50/USD) ≈ 55x a unidade de
--    referência. Ainda uma estimativa (a Google não documenta o preço
--    exato do endpoint legado por campo) — ajustar aqui se o custo real
--    observado divergir.
-- ============================================================

update credit_costs
set custo = 55,
    descricao = 'Verificação extra de telefone/site via Maps na busca por CNPJ (ainda via API oficial — mais cara)',
    updated_at = now()
where acao = 'cnpj_maps_extra';
