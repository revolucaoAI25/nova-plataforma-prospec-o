-- ════════════════════════════════════════════════════════════════════
-- 0045 — Nova tabela de preços
--
-- Starter R$ 147 · 6.000 créditos; Pro R$ 397 · 25.000 créditos;
-- Business R$ 997 · 100.000 créditos. Anual = 10× o mensal ("2 meses
-- grátis"). Pacotes avulsos: P 2.000 por R$ 57, M 10.000 por R$ 237,
-- G 50.000 por R$ 947.
--
-- ANTES de rodar: no admin, ligue "Manter a condição de preço atual" em
-- quem deve ficar na tabela antiga (0044). A fotografia é tirada na hora
-- em que a opção é ligada, então ligar depois desta migration já pegaria
-- os preços novos. Assinaturas ativas no Asaas mantêm o valor delas.
--
-- Pode ser rodada de novo: só grava valores fixos.
-- ════════════════════════════════════════════════════════════════════

update plans set preco_centavos = 14700, preco_anual_centavos = 147000, creditos_mensais = 6000
where nome = 'Starter';

update plans set preco_centavos = 39700, preco_anual_centavos = 397000, creditos_mensais = 25000
where nome = 'Pro';

update plans set preco_centavos = 99700, preco_anual_centavos = 997000, creditos_mensais = 100000
where nome = 'Business';

update credit_packages set preco_centavos = 5700  where nome = 'P' and quantidade_creditos = 2000;
update credit_packages set preco_centavos = 23700 where nome = 'M' and quantidade_creditos = 10000;
update credit_packages set preco_centavos = 94700 where nome = 'G' and quantidade_creditos = 50000;
