-- ============================================================
-- Até quando a assinatura dá acesso.
--
-- Antes, os recursos do plano (flags do perfil) ficavam ligados para
-- sempre depois do 1º pagamento: quem cancelava ou parava de pagar
-- continuava usando a plataforma. Agora cada pagamento confirmado grava
-- profiles.acesso_ate (data do pagamento + 1 mês, ou + 1 ano no anual), e a
-- plataforma bloqueia o uso quando:
--   - cancelada: depois de acesso_ate (o período pago vale até o fim);
--   - inadimplente: 3 dias depois de acesso_ate;
--   - pendente / sem_assinatura: sem período pago e sem acesso liberado
--     pelo admin (créditos ou recursos dados manualmente).
-- A regra fica em src/lib/acesso-regras.ts.
--
-- Só o servidor grava a coluna: ela fica fora da lista livre de
-- proteger_campos_profile (0028).
-- ============================================================

alter table profiles add column if not exists acesso_ate timestamptz;

-- Quem já pagou: último pagamento confirmado + o ciclo da assinatura.
update profiles p
set acesso_ate = u.ultimo + case when p.assinatura_ciclo = 'anual' then interval '1 year' else interval '1 month' end
from (
    select user_id, max(criado_em) as ultimo
    from subscription_payments
    where status = 'pago'
    group by user_id
) u
where u.user_id = p.id
  and p.acesso_ate is null;

-- ------------------------------------------------------------
-- Google Sheets: o client_id/client_secret do app Google da plataforma era
-- copiado para google_sheets_creds de cada usuário que conectava a planilha
-- — e o perfil é legível pelo próprio usuário no navegador. Agora o código
-- lê essas credenciais das chaves da plataforma; aqui saem dos perfis.
-- ------------------------------------------------------------
update profiles
set google_sheets_creds = jsonb_set(google_sheets_creds, '{oauth}', (google_sheets_creds -> 'oauth') - 'client_id' - 'client_secret')
where jsonb_typeof(google_sheets_creds -> 'oauth') = 'object'
  and (google_sheets_creds -> 'oauth' ? 'client_secret' or google_sheets_creds -> 'oauth' ? 'client_id');
