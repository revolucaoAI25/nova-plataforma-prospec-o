-- ============================================================
-- WhatsApp API oficial pela Datafy, conectado pela própria pessoa.
--
-- Antes: a pessoa pedia o canal oficial, o admin criava o canal na Datafy
-- e escaneava junto com ela. Agora, com a conta de parceiro da Datafy, a
-- pessoa clica em "Conectar WhatsApp oficial", a plataforma cria o canal
-- pela API e abre a janela de conexão da Meta (com a marca do Leadmatic);
-- o número fica na BM da própria pessoa.
--
-- 1. Recurso `whatsapp_oficial_habilitado` (plano/perfil/add-on): incluso
--    nos planos Pro e Business; no Starter, add-on pago.
-- 2. `datafy_canais`: os canais criados na conta de parceiro e se estão
--    assinados (o que a Datafy cobra por mês). Só o servidor lê e grava:
--    ninguém marca o próprio canal como "não assinado" para escapar do
--    cancelamento. O canal só é assinado quando o número é conectado, e é
--    cancelado quando a pessoa perde o recurso ou o acesso.
-- ============================================================

alter table plans    add column if not exists whatsapp_oficial_habilitado boolean not null default false;
alter table profiles add column if not exists whatsapp_oficial_habilitado boolean not null default false;

update plans set whatsapp_oficial_habilitado = true where nome in ('Pro', 'Business');

-- Quem já assina Pro ou Business ganha o recurso agora (a ativação do plano
-- só aplica os recursos no 1º pagamento).
update profiles p
set whatsapp_oficial_habilitado = true
from plans pl
where pl.id = p.plano_id
  and pl.whatsapp_oficial_habilitado
  and p.assinatura_status in ('ativa', 'inadimplente');

alter table addons drop constraint if exists addons_feature_flag_check;
alter table addons add constraint addons_feature_flag_check check (feature_flag in (
    'disparo_habilitado', 'instagram_visible', 'linkedin_visible',
    'enriquecimento_ia_habilitado', 'bigdatacorp_enrichment_habilitado',
    'email_disparo_habilitado', 'linkedin_disparo_habilitado',
    'whatsapp_oficial_habilitado'
));

insert into addons (nome, preco_centavos, feature_flag, ordem, descricao) values
    ('WhatsApp API oficial', 9700, 'whatsapp_oficial_habilitado', 2,
     'Conecte o seu número à API oficial do WhatsApp, sem risco de bloqueio. A Meta cobra as mensagens à parte, no cartão da sua conta. Já incluso nos planos Pro e Business.')
on conflict (nome) do nothing;

create table if not exists datafy_canais (
    id              uuid primary key default gen_random_uuid(),
    channel_id      text not null unique,
    user_id         uuid not null references auth.users(id) on delete cascade,
    instance_id     uuid references whatsapp_instances(id) on delete set null,
    assinado        boolean not null default false,
    conectado_em    timestamptz,
    cancelado_em    timestamptz,
    criado_em       timestamptz not null default now()
);

create index if not exists datafy_canais_user_idx on datafy_canais (user_id);

alter table datafy_canais enable row level security;
revoke all on datafy_canais from anon, authenticated;

-- user_stats ganha o recurso no fim (definição anterior em 0034).
create or replace view user_stats as
select
    p.id, p.email, p.role,
    p.credits_renewed_at, p.created_at,
    count(distinct s.id) as total_searches,
    count(distinct l.id) as total_leads,
    max(s.created_at)    as last_search_at,
    p.instagram_visible, p.disparo_habilitado, p.conta_teste, p.teste_expira_em,
    p.enriquecimento_ia_habilitado,
    p.linkedin_visible,
    p.email_disparo_habilitado,
    p.linkedin_disparo_habilitado,
    p.bigdatacorp_enrichment_habilitado,
    p.creditos, p.monthly_creditos,
    p.nome, p.telefone, p.empresa,
    p.teste_gratis,
    p.whatsapp_oficial_habilitado
from profiles p
left join searches s on s.user_id = p.id
left join leads    l on l.user_id = p.id
group by p.id, p.email, p.role, p.credits_renewed_at, p.created_at,
         p.instagram_visible, p.disparo_habilitado, p.conta_teste, p.teste_expira_em,
         p.enriquecimento_ia_habilitado,
         p.linkedin_visible,
         p.email_disparo_habilitado,
         p.linkedin_disparo_habilitado,
         p.bigdatacorp_enrichment_habilitado,
         p.creditos, p.monthly_creditos,
         p.nome, p.telefone, p.empresa,
         p.teste_gratis,
         p.whatsapp_oficial_habilitado;

revoke all on user_stats from anon, authenticated;
grant select on user_stats to service_role;
