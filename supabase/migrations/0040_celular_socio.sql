-- ════════════════════════════════════════════════════════════════════
-- 0040 — Celular do sócio
--
-- O enriquecimento "Sócios e Contato" passa a achar o celular pessoal do
-- sócio: consulta a empresa pelo CNPJ (sócios com CPF), depois cada sócio
-- escolhido pelo CPF (celulares com indicação de WhatsApp e de bloqueio de
-- telemarketing). As tabelas bigdatacorp_enrichment_* continuam com o
-- nome antigo: só o fornecedor mudou.
--
-- 1. Execuções guardam as opções (quais sócios, só WhatsApp, respeitar
--    bloqueio), a pesquisa de origem (para gravar o celular de volta nos
--    leads da busca por CNPJ) e quantas empresas saíram com celular.
-- 2. Cada empresa guarda o sócio escolhido e o celular dele.
-- 3. Leads ganham o celular do sócio (quando a busca pediu).
-- 4. Cache das consultas cadastrais: o mesmo CNPJ/CPF não é pago duas
--    vezes em 90 dias. Guarda CPF completo, então só o servidor lê e grava
--    (RLS ligado, sem política).
-- 5. Custo em créditos de cada sócio consultado.
-- ════════════════════════════════════════════════════════════════════

alter table bigdatacorp_enrichment_runs add column if not exists opcoes jsonb not null default '{}'::jsonb;
alter table bigdatacorp_enrichment_runs add column if not exists search_id uuid references searches(id) on delete set null;
alter table bigdatacorp_enrichment_runs add column if not exists com_celular integer not null default 0;

alter table bigdatacorp_enrichment_leads add column if not exists socio_nome text;
alter table bigdatacorp_enrichment_leads add column if not exists socio_cargo text;
alter table bigdatacorp_enrichment_leads add column if not exists socio_celular text;
alter table bigdatacorp_enrichment_leads add column if not exists socio_whatsapp boolean;

alter table leads add column if not exists celular_socio text;

create table if not exists consultas_cadastrais (
    tipo          text not null check (tipo in ('pj', 'pf')),
    documento     text not null,
    resposta      jsonb,
    consultado_em timestamptz not null default now(),
    primary key (tipo, documento)
);
alter table consultas_cadastrais enable row level security;

insert into credit_costs (acao, custo, descricao) values
    ('socio_celular', 40, 'Celular do sócio — cada sócio consultado pelo CPF')
on conflict (acao) do nothing;

update credit_costs
set descricao = 'Sócios e contato — consulta da empresa pelo CNPJ', updated_at = now()
where acao = 'bigdatacorp';
