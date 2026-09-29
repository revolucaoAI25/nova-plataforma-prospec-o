-- ============================================================
-- Resiliência do construtor de fluxos: hoje um erro em qualquer nó marca a
-- run inteira como terminal ('erro') — sem retry nenhum, mesmo pra falhas
-- claramente passageiras (timeout de rede, API do fornecedor fora do ar
-- por um instante). Isso adiciona retry automático com backoff (até
-- `max_tentativas`, status intermediário 'aguardando_retry' — a run
-- CONTINUA no mesmo nó que falhou, com o mesmo `contexto`, não reinicia do
-- zero) e permite retry manual depois de esgotado (via API, reseta
-- `tentativas` pra 0 e volta pra 'executando').
--
-- Não distingue erro passageiro de erro permanente (ex: "chave não
-- configurada" nunca vai se resolver sozinho) — todo erro entra no mesmo
-- ciclo de retry, até 3x por padrão. É uma simplificação deliberada:
-- separar isso exigiria um classificador de mensagem de erro por
-- executor, frágil e sempre desatualizado; o pior caso é só demorar até
-- ~40min a mais pra reportar um erro que já era permanente, contra
-- automaticamente recuperar os que eram passageiros — vale o trade-off.
-- ============================================================

alter table flow_runs drop constraint if exists flow_runs_status_check;
alter table flow_runs add constraint flow_runs_status_check
    check (status in ('executando', 'aguardando_subprocesso', 'aguardando_retry', 'concluido', 'erro'));

alter table flow_runs add column if not exists tentativas integer not null default 0;
alter table flow_runs add column if not exists max_tentativas integer not null default 3;
alter table flow_runs add column if not exists proxima_tentativa_em timestamptz;

drop index if exists idx_flow_runs_ativas;
create index if not exists idx_flow_runs_ativas
    on flow_runs(status) where status in ('executando', 'aguardando_subprocesso', 'aguardando_retry');
