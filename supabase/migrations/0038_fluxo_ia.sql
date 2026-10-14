-- ════════════════════════════════════════════════════════════════════
-- 0038 — "Criar fluxo com IA"
--
-- Cada geração usa a chave OpenAI da plataforma. A tabela registra as
-- gerações pra limitar quantas cada conta faz por dia (e pra saber o que
-- as pessoas pedem, o que ajuda a melhorar o gerador).
-- ════════════════════════════════════════════════════════════════════

create table if not exists flow_geracoes_ia (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null references auth.users(id) on delete cascade,
    descricao   text not null,
    flow_id     uuid references automation_flows(id) on delete set null,
    erro        text,
    criado_em   timestamptz not null default now()
);
create index if not exists idx_flow_geracoes_ia_user on flow_geracoes_ia(user_id, criado_em desc);

alter table flow_geracoes_ia enable row level security;

drop policy if exists own_or_admin_flow_geracoes_ia on flow_geracoes_ia;
create policy own_or_admin_flow_geracoes_ia on flow_geracoes_ia
    for select using (user_id = auth.uid() or is_admin(auth.uid()));
drop policy if exists own_insert_flow_geracoes_ia on flow_geracoes_ia;
create policy own_insert_flow_geracoes_ia on flow_geracoes_ia
    for insert with check (user_id = auth.uid());
drop policy if exists own_update_flow_geracoes_ia on flow_geracoes_ia;
create policy own_update_flow_geracoes_ia on flow_geracoes_ia
    for update using (user_id = auth.uid()) with check (user_id = auth.uid());
