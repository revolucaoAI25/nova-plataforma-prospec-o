-- ════════════════════════════════════════════════════════════════════
-- 0041 — Origem dos leads sem o nome do fornecedor
--
-- As buscas gravavam em `leads.fonte` o fornecedor ("Apify Maps", "Casa dos
-- Dados"), que aparece no Histórico e nas exportações. Agora é só o tipo de
-- busca: Maps, CNPJ, Instagram, LinkedIn. Pode rodar de novo sem erro.
-- ════════════════════════════════════════════════════════════════════

update leads set fonte = 'Maps'      where fonte in ('Apify Maps', 'Google Maps');
update leads set fonte = 'CNPJ'      where fonte = 'Casa dos Dados';
update leads set fonte = 'Instagram' where fonte = 'instagram';
update leads set fonte = 'LinkedIn'  where fonte = 'linkedin';
