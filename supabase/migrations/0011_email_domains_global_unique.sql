-- ============================================================
-- Corrige uma falha real de segurança multi-tenant em email_domains
-- (0010_email_domains.sql). A constraint original era
-- UNIQUE(user_id, dominio) — permitia usuários DIFERENTES registrarem o
-- MESMO nome de domínio, cada um com sua própria linha. Como
-- criarDominioEmail() (src/lib/email-dispatch-db.ts) reconcilia com o que
-- já existe na conta Resend (uma única conta, compartilhada por TODOS os
-- usuários da plataforma) e copiava o status de lá direto pro registro do
-- usuário — inclusive 'verified' — qualquer usuário que digitasse um
-- domínio já verificado por OUTRO usuário (ex: o revolucao-ai.com da
-- própria plataforma) herdava esse status na hora, sem nenhuma prova de
-- posse do DNS.
--
-- Um domínio real só tem um dono — é assim que DNS funciona — então a
-- constraint agora reflete isso: um domínio só pode existir em UMA linha
-- da tabela inteira, não uma por usuário. `criarDominioEmail()` foi
-- ajustada pra rejeitar explicitamente quando o domínio já pertence a
-- outro usuário, em vez de confiar cegamente no que a Resend devolve.
-- ============================================================

alter table email_domains drop constraint if exists email_domains_user_id_dominio_key;
alter table email_domains add constraint email_domains_dominio_key unique (dominio);
