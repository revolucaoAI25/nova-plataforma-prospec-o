-- ============================================================
-- Cota de e-mail diferenciada por plano — pedido explícito do usuário
-- ("a cota do e-mail pode configurar, pensa num valor que faz sentido").
-- O mecanismo de limite já existe (email_senders.limite_diario_envios,
-- por remetente — não existe hoje um contador agregado mensal por
-- usuário, e criar um exigiria um novo pipeline de contagem só pra isso).
-- Em vez de inventar uma unidade nova, plans ganha um limite DIÁRIO
-- sugerido (mesma unidade já suportada), usado como valor inicial de
-- qualquer remetente novo que o usuário criar — ele continua podendo
-- editar por remetente depois, como já era.
-- ============================================================

alter table plans add column if not exists email_limite_diario integer;

update plans set email_limite_diario = 100 where nome = 'Starter';
update plans set email_limite_diario = 300 where nome = 'Pro';
update plans set email_limite_diario = 1000 where nome = 'Business';
