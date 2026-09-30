-- ============================================================
-- Onboarding com planos personalizados por IA. O cliente responde um
-- questionário (respostas), a IA monta de 3 a 4 planos de prospecção
-- (resultado) e cada plano que ele escolhe vira automações reais na conta
-- (onboarding_aplicacoes: fluxo pausado + campanhas em rascunho + funil),
-- que só começam a rodar quando ele conecta os canais e dá play.
--
-- A geração roda no worker (worker/onboarding-tick.ts), não na requisição:
-- são 2 a 4 chamadas de IA em sequência (gerar, avaliar, às vezes revisar
-- e reavaliar), longas demais pra prender uma requisição HTTP.
-- `processando_desde` é o lease que impede dois ticks de gerarem o mesmo
-- onboarding em paralelo; um lease velho (worker caiu no meio) é retomado.
--
-- Escrita só pelo servidor (service role, com a checagem de dono feita na
-- rota): o cliente lê as próprias linhas, mas não grava `resultado` nem
-- status direto — o que ele aplica sai do que a plataforma gerou.
-- ============================================================

create table if not exists onboarding (
    user_id            uuid primary key references auth.users(id) on delete cascade,
    respostas          jsonb not null default '{}'::jsonb,
    status             text not null default 'rascunho'
                       check (status in ('rascunho', 'gerando', 'pronto', 'erro')),
    resultado          jsonb,
    erro               text,
    tentativas         integer not null default 0,
    solicitado_em      timestamptz,
    processando_desde  timestamptz,
    gerado_em          timestamptz,
    atualizado_em      timestamptz not null default now()
);

alter table onboarding enable row level security;

drop policy if exists "own_or_admin_select_onboarding" on onboarding;
create policy "own_or_admin_select_onboarding" on onboarding
    for select using (user_id = auth.uid() or is_admin(auth.uid()));

create index if not exists idx_onboarding_gerando on onboarding(status) where status = 'gerando';

create table if not exists onboarding_aplicacoes (
    id           uuid primary key default gen_random_uuid(),
    user_id      uuid not null references auth.users(id) on delete cascade,
    letra        text not null,
    cenario_id   text not null,
    titulo       text not null,
    flow_id      uuid references automation_flows(id) on delete set null,
    funil_id     uuid references funis(id) on delete set null,
    campanhas    jsonb not null default '{}'::jsonb,
    status       text not null default 'aguardando_conexoes'
                 check (status in ('aguardando_conexoes', 'ativo', 'pausado')),
    criado_em    timestamptz not null default now(),
    ativado_em   timestamptz,
    unique (user_id, letra)
);

alter table onboarding_aplicacoes enable row level security;

drop policy if exists "own_or_admin_select_onboarding_aplicacoes" on onboarding_aplicacoes;
create policy "own_or_admin_select_onboarding_aplicacoes" on onboarding_aplicacoes
    for select using (user_id = auth.uid() or is_admin(auth.uid()));
