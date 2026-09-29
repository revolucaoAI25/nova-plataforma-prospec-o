-- ============================================================
-- Pool único de créditos — substitui as 4 carteiras separadas
-- (cdd_credits/maps_credits/instagram_credits/linkedin_credits), que hoje
-- debitam todas a 1 crédito por lead, sem relação nenhuma com o custo real
-- de cada fornecedor por trás. A partir daqui, cada ação tem um peso
-- (`credit_costs.custo`) proporcional ao custo real de mercado levantado
-- com o usuário (Casa dos Dados R$0,005/consulta, Maps via Apify
-- ~R$0,022/lugar, Instagram via Apify ~R$0,0036/resultado, LinkedIn via
-- Apify ~R$0,044-0,077/perfil, BigDataCorp básico ~R$0,024-0,030/consulta,
-- BigDataCorp sócios/decisor ~R$0,114-0,140/consulta) — usando 1 crédito
-- ≈ R$0,005 como unidade de referência (o menor custo real observado).
--
-- As 4 colunas antigas ficam na tabela como registro histórico — nenhum
-- código novo lê ou escreve nelas depois desta migration. `custo` fica
-- numa tabela (não hardcoded) de propósito: preço de fornecedor muda, e
-- ajustar isso não deveria exigir deploy.
-- ============================================================

alter table profiles add column if not exists creditos integer not null default 0;
alter table profiles add column if not exists monthly_creditos integer not null default 0;

-- Migra o saldo existente pro pool único somando as 4 carteiras, pra
-- ninguém perder poder de compra na troca.
update profiles
set creditos = cdd_credits + maps_credits + instagram_credits + linkedin_credits,
    monthly_creditos = monthly_cdd_credits + monthly_maps_credits + monthly_instagram_credits + monthly_linkedin_credits
where creditos = 0;

create table if not exists credit_costs (
    acao        text primary key,
    custo       integer not null check (custo > 0),
    descricao   text not null,
    updated_at  timestamptz not null default now()
);

-- Pesos: 1 crédito ≈ R$0,005 (o menor custo real observado, Casa dos
-- Dados). `bigdatacorp`: a integração consulta os 3 datasets (basic_data +
-- registration_data + dynamic_qsa_data — sócios/decisor) numa chamada só
-- (ver DATASETS em src/lib/integrations/bigdatacorp.ts), então o custo real
-- por consulta é sempre a soma dos três, não existe hoje um modo "só
-- básico" mais barato para oferecer separado. basic_data ~R$0,027 +
-- registration_data ~R$0,127 + dynamic_qsa_data (preço não confirmado
-- publicamente — estimado na mesma faixa do registration_data até
-- confirmar) ~R$0,04 ≈ R$0,194/consulta.
insert into credit_costs (acao, custo, descricao) values
    ('cnpj',               1,  'Busca de empresas por CNPJ'),
    ('cnpj_maps_extra',    5,  'Verificação extra de telefone/site via Maps na busca por CNPJ'),
    ('maps',               5,  'Busca avulsa no Google Maps'),
    ('instagram',          1,  'Busca de perfis no Instagram'),
    ('linkedin',           12, 'Busca de perfis no LinkedIn'),
    ('bigdatacorp',        40, 'Enriquecimento de CNPJ — cadastro, contato e sócios/decisor')
on conflict (acao) do nothing;

alter table credit_costs enable row level security;

-- Todo usuário autenticado pode LER o custo (precisa saber quanto algo vai
-- custar antes de rodar); só admin escreve.
drop policy if exists "leitura_credit_costs" on credit_costs;
create policy "leitura_credit_costs" on credit_costs
    for select using (auth.role() = 'authenticated');

drop policy if exists "admin_escreve_credit_costs" on credit_costs;
create policy "admin_escreve_credit_costs" on credit_costs
    for all using (is_admin(auth.uid()));

-- RPC de débito atomico do pool único — mais simples que o decrement_credits
-- antigo (que precisava de whitelist de campo porque cada fonte tinha sua
-- própria coluna). decrement_credits continua existindo, mas nenhum código
-- novo o chama.
create or replace function decrement_creditos(
    p_user_id uuid,
    p_delta   integer
) returns void
language plpgsql security definer as $$
begin
    if p_delta <= 0 then
        return;
    end if;
    update profiles set creditos = greatest(0, creditos - p_delta) where id = p_user_id;
end;
$$;

-- ── user_stats: acrescenta creditos/monthly_creditos no final
-- (CREATE OR REPLACE VIEW só aceita colunas novas no fim da lista) ──
create or replace view user_stats as
select
    p.id, p.email, p.role,
    p.cdd_credits, p.monthly_cdd_credits,
    p.maps_credits, p.monthly_maps_credits, p.maps_credits_enabled,
    p.credits_renewed_at, p.created_at,
    count(distinct s.id) as total_searches,
    count(distinct l.id) as total_leads,
    max(s.created_at)    as last_search_at,
    p.instagram_credits, p.monthly_instagram_credits, p.instagram_credits_enabled,
    p.instagram_visible, p.disparo_habilitado, p.conta_teste, p.teste_expira_em,
    p.enriquecimento_ia_habilitado,
    p.linkedin_credits, p.monthly_linkedin_credits, p.linkedin_credits_enabled,
    p.linkedin_visible,
    p.email_disparo_habilitado,
    p.linkedin_disparo_habilitado,
    p.bigdatacorp_enrichment_habilitado,
    p.creditos, p.monthly_creditos
from profiles p
left join searches s on s.user_id = p.id
left join leads    l on l.user_id = p.id
group by p.id, p.email, p.role, p.cdd_credits, p.monthly_cdd_credits,
         p.maps_credits, p.monthly_maps_credits, p.maps_credits_enabled,
         p.credits_renewed_at, p.created_at,
         p.instagram_credits, p.monthly_instagram_credits, p.instagram_credits_enabled,
         p.instagram_visible, p.disparo_habilitado, p.conta_teste, p.teste_expira_em,
         p.enriquecimento_ia_habilitado,
         p.linkedin_credits, p.monthly_linkedin_credits, p.linkedin_credits_enabled,
         p.linkedin_visible,
         p.email_disparo_habilitado,
         p.linkedin_disparo_habilitado,
         p.bigdatacorp_enrichment_habilitado,
         p.creditos, p.monthly_creditos;
