# Prospecção Ativa — Nova Plataforma

Reconstrução completa da plataforma de prospecção ativa em Next.js + TypeScript +
Supabase, substituindo o produto atual em Streamlit (`prospec-o-ativa`). Este
repositório é **novo e independente** — nada aqui afeta o produto em produção.

Cobre a plataforma inteira: autenticação e créditos, extração (CNPJ via Casa dos
Dados, Google Maps, Instagram via Apify), disparo WhatsApp (Evolution API e canal
oficial), automações agendadas, exportação (Excel/CSV/Google Sheets), contas de
teste e administração.

## Stack

- **Frontend/Backend**: Next.js 16 (App Router, TypeScript) — API routes fazem a
  orquestração server-side (chaves de API nunca chegam ao navegador).
- **Worker de background**: processo Node separado (`worker/`) que roda os dois
  schedulers (automações e fila de disparo) — deploy como um **segundo serviço
  Railway** apontando pro mesmo repositório. Ver seção "Deploy" abaixo.
- **Banco**: Supabase (Postgres + Auth + RLS) — projeto **novo**, não reaproveitar o
  do produto atual.
- **UI**: Tailwind CSS v4 + componentes próprios no padrão shadcn/ui (Radix UI +
  class-variance-authority) — o registro `ui.shadcn.com` não estava acessível na
  sessão em que isso foi construído, então os componentes em `src/components/ui`
  foram escritos à mão seguindo o mesmo padrão; dá para trocar por `npx shadcn add`
  depois sem conflito.
- **Exportação**: `exceljs` (Excel), geração manual de CSV, `googleapis` (Google
  Sheets via OAuth).

## Setup

### 1. Crie um projeto Supabase novo

No [painel do Supabase](https://supabase.com/dashboard), crie um projeto novo
(não o mesmo do produto atual). Em **SQL Editor**, rode nesta ordem:
1. `supabase/migrations/0001_init.sql`
2. `supabase/migrations/0002_full_platform.sql`

Em **Authentication → Providers**, deixe E-mail/senha habilitado (é o único método
usado no login). Contas são criadas pelo admin — não há cadastro público.

### 2. Variáveis de ambiente

Copie `.env.example` para `.env.local` e preencha (cada variável está comentada
no arquivo com onde consegui-la). Resumo do que é obrigatório vs. opcional:

**Obrigatórias para rodar o básico (auth + busca CNPJ/Maps):**
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `CDD_API_KEY`, `GOOGLE_MAPS_API_KEY`,
`NEXT_PUBLIC_APP_URL`.

**Opcionais, por funcionalidade** (a funcionalidade correspondente fica
indisponível/com erro amigável se faltar, o resto da plataforma funciona normalmente):
- `APIFY_API_KEY` — busca Instagram e fallback de Google Maps.
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — conectar Google Sheets.
- `EVOLUTION_API_URL` / `EVOLUTION_API_KEY` — disparo WhatsApp (canal não-oficial).
- `DATAFY_API_BASE_URL` — canal oficial do WhatsApp (tem um padrão razoável, só
  precisa mudar se usar outro provedor).

Cada uma dessas chaves "padrão da plataforma" pode ser sobreposta por usuário
(chave própria em Configurações, ou administrada individualmente em `/admin/[userId]`)
— a ordem de prioridade está comentada em `src/lib/maps-key.ts` e `src/lib/apify-key.ts`.

### 3. Crie o primeiro usuário admin

Sem cadastro público, o primeiro usuário precisa ser criado direto no Supabase:
**Authentication → Users → Add user** (marque "Auto Confirm User"), depois em
**Table Editor → profiles**, edite a linha criada pelo trigger e mude `role` para
`admin`. A partir daí, esse admin cria os demais usuários por `/admin`.

### 4. Rodar localmente

```bash
npm install
npm run dev       # app Next.js em http://localhost:3000
npm run worker    # worker de automações/disparo (opcional pra testar essas duas features)
```

## Deploy (Railway)

São **dois serviços Railway** apontando pro mesmo repositório:

1. **App web** — `railway.toml` já configura build (`npm run build`) e start
   (`npm run start`). Cole todas as variáveis de ambiente aqui.
2. **Worker** — crie um segundo serviço no mesmo projeto Railway, mesmo repo,
   mesma branch, mas sobrescreva o **Start Command** nas configurações do serviço
   para `npm run worker` (o build command pode continuar `npm run build`, o
   worker não depende dele, mas rodá-lo não tem custo). Cole as mesmas variáveis
   de ambiente — o worker só usa `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
   e as chaves de integração (não usa a anon key nem `NEXT_PUBLIC_APP_URL`).

Sem o worker rodando, tudo funciona **exceto** automações agendadas e o envio de
fato das mensagens de disparo (a UI de criar campanha/cadência/instância funciona,
mas nada é processado — é só fila).

## Decisões de arquitetura (e incertezas herdadas do produto atual)

- **Google Maps — endpoint legado**: por decisão explícita nesta reconstrução,
  `src/lib/integrations/google-maps.ts` replica o comportamento já validado do
  produto atual (Places API legada) em vez de migrar já para `v1/places:searchText`.
  O Google congelou o endpoint legado em março/2025 (sem novos projetos, com
  depreciação futura anunciada) — projetos Google Cloud **novos** podem não
  conseguir ativá-lo. Migrar para o endpoint novo deve ser revisitado antes de
  abrir contas novas; ver comentário no topo do arquivo.
- **CNAE "secundário"**: o corpo da requisição à Casa dos Dados ainda manda
  `codigo_atividade_secundaria` como array paralelo (igual ao produto atual) — há
  indícios não confirmados de que a API pode esperar um campo diferente. Vale
  testar direto com a API antes de expandir o uso desse filtro.
- **Filtros completos salvos em JSONB**: diferente do produto atual (que só
  guardava um resumo), `searches.filtros` guarda o filtro completo usado em cada
  busca — permite auditoria e, no futuro, "repetir esta busca".
- **Google Sheets — OAuth único da plataforma**: diferente do produto atual (que
  aceitava client_id/secret por usuário via Streamlit Secrets), aqui há um único
  client OAuth (`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`) e cada usuário só
  autoriza o acesso — mais simples de operar, é o padrão de fato pra esse tipo de
  fluxo "Conectar sua conta Google".
- **dispatch-db.ts e automation-db.ts parametrizados por cliente Supabase**:
  diferente do produto atual (que usava sempre o cliente service-role, "pra
  funcionar tanto na UI quanto no scheduler"), aqui as rotas de API interativas
  passam o cliente autenticado do usuário — RLS restringe automaticamente ao
  próprio dono ou admin — e só o worker de background passa o cliente
  service-role (que precisa operar entre usuários). Mais seguro por padrão.
- **Não implementado nesta reconstrução** (gaps conhecidos, não são bugs):
  a UI de disparo não tem uma tela dedicada para configurar o monitoramento de
  planilha (`sheet_watch`) — a rota de API e o worker já suportam, falta o botão;
  templates do canal oficial não têm preview de aprovação em tempo real (é preciso
  recarregar a página do template pra ver o status atualizado).

## Estrutura

```
src/
  app/
    login/                    página de login
    (app)/                    área autenticada (proxy.ts redireciona sem sessão)
      busca/cnpj|maps|instagram/  as três buscas
      historico/                lista + detalhe de pesquisas
      automacoes/                buscas agendadas
      disparo/                   instâncias, campanhas, cadência, solicitação de canal oficial
      configuracoes/              chaves próprias (Maps, Apify) e Google Sheets
      admin/                      usuários, créditos, chaves administradas, canal oficial
    api/                       rotas de servidor (nunca expõem chaves ao cliente)
  components/
    ui/                        componentes de base (botão, input, tabela...)
    search/ historico/ settings/ admin/ layout/ dispatch/ automations/
  lib/
    integrations/              Casa dos Dados, Google Maps, Apify, Instagram, Sheets, Evolution API, WhatsApp oficial
    data/                      catálogos de CNAE, nichos e estados
    supabase/                  clientes (browser, server, admin) e sessão do proxy
    credits.ts db.ts export.ts maps-key.ts apify-key.ts    lógica de negócio de extração
    dispatch-db.ts automation-db.ts automation-logic.ts automation-runner.ts   disparo e automações
worker/                        processo de background (automações + fila de disparo)
supabase/migrations/           schema SQL (0001 = Fase 0, 0002 = plataforma completa)
```
