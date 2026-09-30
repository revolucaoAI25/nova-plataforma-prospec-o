-- ============================================================
-- Plano anual (opção A, decidida pelo usuário): uma assinatura Asaas de
-- verdade com `cycle: YEARLY` — 1 cobrança por ano, não 12 cobranças
-- mensais de um valor menor. Desconto padrão: paga 10 meses, leva 12
-- (~16,7% off, "2 meses grátis") — `preco_anual_centavos` fica em
-- `plans` como um preço independente, não uma fórmula, pra o admin poder
-- ajustar o desconto por plano sem depender de recalcular nada.
--
-- Como o Asaas só dispara um evento de pagamento por ANO nesse ciclo,
-- `processarPagamentoAssinatura` (subscriptions-db.ts) precisa saber que
-- ciclo aquela assinatura é pra decidir quanto creditar de uma vez —
-- `assinatura_ciclo` guarda isso. Decisão: no plano anual, credita os 12
-- meses de uma vez só no momento da confirmação (não fica "represando"
-- 1/12 por mês) — mais simples que construir um mecanismo de liberação
-- gradual à parte do calendário de cobrança do Asaas, e é o padrão comum
-- de "assinatura anual" em outros produtos (acesso ao ano todo já no ato).
-- `monthly_creditos` continua guardando a TAXA mensal equivalente (não o
-- lote credido de uma vez), só pra manter o card "Renovação mensal" do
-- dashboard com o mesmo significado nos dois ciclos.
-- ============================================================

alter table plans add column if not exists preco_anual_centavos integer;
update plans set preco_anual_centavos = preco_centavos * 10;

alter table profiles add column if not exists assinatura_ciclo text not null default 'mensal'
    check (assinatura_ciclo in ('mensal', 'anual'));
