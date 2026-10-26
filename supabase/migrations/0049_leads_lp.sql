-- ============================================================
-- Leads da página de vendas, num quadro (Kanban) do admin: /admin/leads.
--
-- Cada pessoa que preenche o formulário de contratação ou do teste grátis
-- vira um lead, mesmo sem concluir (o preenchimento parcial é capturado
-- quando o e-mail ou o WhatsApp já foi digitado). Depois o lead avança
-- sozinho: teste grátis criado, conta criada aguardando pagamento, cliente
-- (pagamento aprovado). O admin pode arrastar para "Em contato" ou
-- "Perdido" e anotar; uma etapa nova (ex.: pagou) sempre traz o card de
-- volta para a coluna da etapa.
--
-- `etapa` = a mais avançada que a pessoa alcançou (só sobe);
-- `coluna` = onde o card está no quadro.
-- Leitura e escrita só pelo servidor (service role).
--
-- Também: whatsapp_instances.webhook_url, o endereço em que o webhook da
-- Evolution foi registrado — o worker registra de novo quando o domínio
-- da plataforma (NEXT_PUBLIC_APP_URL) muda.
-- ============================================================

create table if not exists lp_leads (
    id             uuid primary key default gen_random_uuid(),
    visitante      text,
    user_id        uuid references auth.users(id) on delete set null,
    nome           text,
    email          text,
    telefone       text,
    empresa        text,
    pagina         text,
    plano          text,
    ciclo          text,
    etapa          text not null default 'preencheu'
                   check (etapa in ('preencheu', 'teste', 'aguardando_pagamento', 'cliente')),
    coluna         text not null default 'preencheu'
                   check (coluna in ('preencheu', 'em_contato', 'teste', 'aguardando_pagamento', 'cliente', 'perdido')),
    notas          text,
    utm_source     text,
    utm_medium     text,
    utm_campaign   text,
    utm_content    text,
    criado_em      timestamptz not null default now(),
    atualizado_em  timestamptz not null default now(),
    movido_em      timestamptz not null default now()
);

create unique index if not exists lp_leads_visitante_uidx on lp_leads (visitante) where visitante is not null;
create unique index if not exists lp_leads_user_uidx on lp_leads (user_id) where user_id is not null;
create index if not exists lp_leads_email_idx on lp_leads (lower(email));
create index if not exists lp_leads_coluna_idx on lp_leads (coluna, atualizado_em desc);

alter table lp_leads enable row level security;
revoke all on lp_leads from anon, authenticated;

-- Quem já se cadastrou pela página nos últimos 90 dias entra no quadro.
insert into lp_leads (user_id, nome, email, telefone, empresa, pagina, etapa, coluna, utm_source, utm_medium, utm_campaign, utm_content, criado_em, atualizado_em, movido_em)
select
    p.id, p.nome, p.email, p.telefone, p.empresa,
    case when p.teste_gratis then 'teste' else 'assinar' end,
    x.etapa, x.etapa,
    p.rastreamento ->> 'utm_source', p.rastreamento ->> 'utm_medium', p.rastreamento ->> 'utm_campaign', p.rastreamento ->> 'utm_content',
    p.created_at, p.created_at, p.created_at
from profiles p
cross join lateral (
    select case
        when exists (select 1 from subscription_payments sp where sp.user_id = p.id and sp.status = 'pago') then 'cliente'
        when p.assinatura_status = 'pendente' then 'aguardando_pagamento'
        when p.teste_gratis then 'teste'
    end as etapa
) x
where p.role <> 'admin'
  and p.created_at > now() - interval '90 days'
  and x.etapa is not null
  and not exists (select 1 from lp_leads l where l.user_id = p.id);

alter table whatsapp_instances add column if not exists webhook_url text;
