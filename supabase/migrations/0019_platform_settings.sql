-- ============================================================
-- Chaves de API de plataforma, administráveis via /admin em vez de só
-- variável de ambiente do Railway — pedido explícito: mais fácil pro
-- admin trocar uma chave (ex: renovar a do Resend) sem precisar mexer no
-- painel do Railway e esperar redeploy. Cobre TODAS as integrações de
-- terceiro que a plataforma usa com uma chave própria (não do usuário):
-- Resend, Unipile, BigDataCorp, Asaas, Google Sheets OAuth. FICA DE FORA
-- a chave OpenAI do Enriquecimento por IA — essa é BYOK por usuário
-- (profiles.openai_api_key), nunca da plataforma, e as chaves com pool
-- por usuário (Google Maps/Apify/Casa dos Dados — profiles.*_api_key_admin
-- e *_keys_pool) também ficam fora: já têm seu próprio mecanismo
-- administrável por usuário desde antes, isto aqui é só para as chaves
-- que eram puro process.env.X sem nenhuma camada administrável.
--
-- Key-value simples (não uma coluna por serviço) para não precisar de
-- migration toda vez que um novo serviço aparecer. O valor em texto puro
-- na tabela é aceitável aqui pela mesma razão que já vale para
-- profiles.*_api_key_admin: quem tem acesso de leitura a esta tabela via
-- RLS é só o service role (nunca o client anon/authenticated) — o app só
-- lê isto num resolver de servidor (src/lib/platform-settings.ts), nunca
-- do navegador.
-- ============================================================

create table if not exists platform_settings (
    chave        text primary key,
    valor        text,
    atualizado_em timestamptz not null default now(),
    atualizado_por uuid references auth.users(id) on delete set null
);

alter table platform_settings enable row level security;

-- Nenhuma policy de select/insert/update pro authenticated/anon: só o
-- service role (que ignora RLS) lê/escreve. Igual à decisão já tomada
-- para tabelas alimentadas exclusivamente por webhook (subscription_payments,
-- credit_purchases) — aqui o cliente nunca deve ver o valor bruto das
-- chaves, nem o admin comum via query direta ao Supabase, só pela rota
-- /api/admin/platform-settings (que mascara o valor na resposta).
