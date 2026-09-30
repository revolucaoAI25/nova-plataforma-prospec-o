-- ════════════════════════════════════════════════════════════════════
-- 0031 — Funil automático: resposta para a cadência e move o card
--
-- 1. Colunas do funil ganham `papel` (entrada, cadencia, respondeu, ganho,
--    perdido). Funis criados pelas sugestões do onboarding usam isso pra
--    mover os cards sozinhos; funis manuais ficam com papel nulo e nada
--    muda pra eles.
-- 2. Cards ganham `contatos` (chaves normalizadas: tel:DDD+8 dígitos,
--    email:..., li:<slug do perfil>) pra casar uma resposta recebida no
--    WhatsApp/LinkedIn com o card e com os alvos das campanhas. O telefone
--    usa DDD + 8 últimos dígitos porque o WhatsApp às vezes entrega o
--    número sem o 9º dígito.
-- 3. Alvos de disparo (WhatsApp, e-mail, LinkedIn) ganham o status
--    'respondeu' + `respondido_em`: quem responde sai da fila de follow-up
--    em todos os canais.
-- 4. `onboarding_aplicacoes.plano`: cópia da sugestão usada, pra gerar as
--    sugestões de novo não bagunçar o passo a passo de quem já aplicou.
-- 5. `whatsapp_instances.webhook_configurado_em`: quando o webhook de
--    mensagens recebidas foi registrado na Evolution.
-- ════════════════════════════════════════════════════════════════════

alter table funil_colunas add column if not exists papel text
    check (papel in ('entrada', 'cadencia', 'respondeu', 'ganho', 'perdido'));

alter table funil_cards add column if not exists contatos text[] not null default '{}';
create index if not exists idx_funil_cards_contatos on funil_cards using gin (contatos);
create index if not exists idx_funil_cards_user on funil_cards(user_id);

-- Mesma regra de src/lib/contatos.ts (chaveTelefone) — manter as duas iguais.
create or replace function chave_telefone(t text) returns text
language plpgsql immutable as $$
declare
    d text := regexp_replace(coalesce(t, ''), '\D', '', 'g');
begin
    if length(d) >= 12 and left(d, 2) = '55' then
        d := substr(d, 3);
    end if;
    if length(d) < 10 then
        return null;
    end if;
    return 'tel:' || left(d, 2) || right(d, 8);
end;
$$;

update funil_cards set contatos = array_remove(array[
    chave_telefone(lead_snapshot->>'telefone'),
    case when coalesce(trim(lead_snapshot->>'email'), '') like '%@%'
         then 'email:' || lower(trim(lead_snapshot->>'email')) end,
    case when lead_snapshot->>'linkedin_url' ~* 'linkedin\.com/in/'
         then 'li:' || lower(substring(lead_snapshot->>'linkedin_url' from '(?i)linkedin\.com/in/([^/?#]+)')) end
], null)
where contatos = '{}';

alter table dispatch_targets drop constraint if exists dispatch_targets_status_check;
alter table dispatch_targets add constraint dispatch_targets_status_check
    check (status in ('pendente', 'enviando', 'enviado', 'concluido', 'falhou', 'removido', 'respondeu'));
alter table dispatch_targets add column if not exists respondido_em timestamptz;

alter table email_targets drop constraint if exists email_targets_status_check;
alter table email_targets add constraint email_targets_status_check
    check (status in ('pendente', 'enviando', 'enviado', 'concluido', 'falhou', 'removido', 'respondeu'));
alter table email_targets add column if not exists respondido_em timestamptz;

alter table linkedin_targets drop constraint if exists linkedin_targets_status_check;
alter table linkedin_targets add constraint linkedin_targets_status_check
    check (status in ('pendente', 'enviando', 'aguardando_aceite', 'enviado', 'concluido', 'falhou', 'removido', 'respondeu'));
alter table linkedin_targets add column if not exists respondido_em timestamptz;

alter table onboarding_aplicacoes add column if not exists plano jsonb;

alter table whatsapp_instances add column if not exists webhook_configurado_em timestamptz;

-- Cada uso de sugestão pertence a uma geração (resultado.geradoEm): gerar
-- sugestões novas não bloqueia usar a nova "Sugestão A" só porque a A
-- antiga já foi usada. Linhas antigas herdam a geração atual do usuário.
alter table onboarding_aplicacoes add column if not exists geracao text;
update onboarding_aplicacoes a set geracao = o.resultado->>'geradoEm'
  from onboarding o where o.user_id = a.user_id and a.geracao is null;
alter table onboarding_aplicacoes drop constraint if exists onboarding_aplicacoes_user_id_letra_key;
create unique index if not exists idx_onboarding_aplicacoes_geracao on onboarding_aplicacoes(user_id, letra, geracao);
