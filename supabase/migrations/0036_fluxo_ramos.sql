-- ════════════════════════════════════════════════════════════════════
-- 0036 — Fluxos com ramos (saídas condicionais)
--
-- Até aqui o fluxo era uma linha só: cada nó tinha uma saída. Agora alguns
-- nós têm saídas extras:
--   - "Filtrar leads": quem atende segue pela saída principal, quem não
--     atende sai por "Não atende";
--   - disparos (WhatsApp, e-mail, LinkedIn): além de "Em seguida" (segue na
--     hora com quem foi inscrito, como sempre foi), saem leads por
--     "Enviou", "Falhou", "Respondeu" e "Sem resposta" conforme a campanha
--     anda — o que pode levar dias.
--
-- 1. flow_runs ganha a origem do ramo: um ramo roda numa execução própria
--    (`ramo_saida` + `ramo_no_id`), ligada à execução que o abriu quando
--    existe uma (`run_pai_id`). Execuções de ramo não seguram o gatilho do
--    fluxo: o agendamento continua rodando no horário mesmo com ramos em
--    andamento.
-- 2. Alvos de disparo guardam de qual fluxo/nó vieram e quais saídas já
--    foram entregues ao fluxo (`flow_saidas`). `flow_encerrado_em` tira o
--    alvo da varredura quando não há mais nada a acontecer com ele.
-- ════════════════════════════════════════════════════════════════════

alter table flow_runs add column if not exists ramo_saida text;
alter table flow_runs add column if not exists ramo_no_id text;
alter table flow_runs add column if not exists run_pai_id uuid references flow_runs(id) on delete set null;
create index if not exists idx_flow_runs_pai on flow_runs(run_pai_id) where run_pai_id is not null;

do $$
declare
    t text;
begin
    foreach t in array array['dispatch_targets', 'email_targets', 'linkedin_targets'] loop
        execute format('alter table %I add column if not exists flow_id uuid references automation_flows(id) on delete set null', t);
        execute format('alter table %I add column if not exists flow_node_id text', t);
        execute format('alter table %I add column if not exists flow_run_id uuid references flow_runs(id) on delete set null', t);
        execute format('alter table %I add column if not exists flow_saidas text[] not null default ''{}''', t);
        execute format('alter table %I add column if not exists flow_encerrado_em timestamptz', t);
        execute format(
            'create index if not exists %I on %I (flow_id) where flow_id is not null and flow_encerrado_em is null',
            'idx_' || t || '_flow_aberto', t
        );
    end loop;
end $$;
