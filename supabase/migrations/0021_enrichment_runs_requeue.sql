-- ============================================================
-- Achado do check-up geral das automações (ver README): uma run de fluxo
-- parada em `aguardando_subprocesso`, esperando um enrichment_runs/
-- bigdatacorp_enrichment_runs terminar, ficava travada pra sempre se o
-- worker reiniciasse com a linha em `processando` — sem timestamp de
-- início, não dava pra saber que a linha estava órfã. `processando_desde`
-- resolve isso: gravado no momento da reserva atômica (pendente →
-- processando), lido por um requeueTravados-equivalente nos dois ticks
-- (mesmo padrão de dispatch-db.ts::requeueTravados, que já protege a fila
-- de disparo do mesmo jeito).
-- ============================================================

alter table enrichment_runs add column if not exists processando_desde timestamptz;
alter table bigdatacorp_enrichment_runs add column if not exists processando_desde timestamptz;
