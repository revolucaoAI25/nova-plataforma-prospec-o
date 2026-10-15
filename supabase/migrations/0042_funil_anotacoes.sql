-- Anotações livres no negócio do funil (detalhe do card): o que foi
-- combinado numa ligação, próximo passo, etc.
alter table funil_cards add column if not exists anotacoes text;
