# Prospecção Ativa — Nova Plataforma (Fase 0)

Reconstrução da plataforma de prospecção ativa em Next.js + TypeScript + Supabase,
substituindo o produto atual em Streamlit (`prospec-o-ativa`). Este repositório é
**novo e independente** — nada aqui afeta o produto em produção.

Fase 0 (este estado do projeto) cobre: autenticação, créditos, busca CNPJ (Casa dos
Dados), busca Google Maps, enriquecimento/filtro de CNPJ via Maps, histórico e
exportação (Excel/CSV). Disparo, automações, Instagram, LinkedIn e onboarding
multicanal ficam para as fases seguintes — ver o plano de reconstrução.

## Stack

- **Frontend/Backend**: Next.js 16 (App Router, TypeScript) — API routes fazem a
  orquestração server-side (chaves de API nunca chegam ao navegador).
- **Banco**: Supabase (Postgres + Auth + RLS) — projeto **novo**, não reaproveitar o
  do produto atual.
- **UI**: Tailwind CSS v4 + componentes próprios no padrão shadcn/ui (Radix UI +
  class-variance-authority) — o registro `ui.shadcn.com` não estava acessível nesta
  sessão, então os componentes em `src/components/ui` foram escritos à mão seguindo
  o mesmo padrão; dá para trocar por `npx shadcn add` depois sem conflito.
- **Exportação**: `exceljs` (Excel) e geração manual de CSV.

## Setup

### 1. Crie um projeto Supabase novo

No [painel do Supabase](https://supabase.com/dashboard), crie um projeto novo
(não o mesmo do produto atual). Em **SQL Editor**, rode o conteúdo de
`supabase/migrations/0001_init.sql`.

Em **Authentication → Providers**, deixe E-mail/senha habilitado (é o único método
usado no login). Contas são criadas pelo admin (ver seção Admin abaixo) — não há
cadastro público nesta fase.

### 2. Variáveis de ambiente

Copie `.env.example` para `.env.local` e preencha:

```bash
cp .env.example .env.local
```

- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Project Settings → API.
- `SUPABASE_SERVICE_ROLE_KEY` — mesma tela; **nunca** expor no cliente (só usada em
  rotas de servidor: `src/lib/supabase/admin.ts`).
- `CDD_API_KEY` — chave padrão da plataforma para a Casa dos Dados (casadosdados.com.br).
  Cada usuário pode ter uma chave individual administrada pelo admin
  (`profiles.cdd_api_key_admin`, editável em `/admin/[userId]`), que tem prioridade
  sobre esta.
- `GOOGLE_MAPS_API_KEY` — chave padrão da plataforma (Places API **legada** — ver
  nota abaixo). Cada usuário pode ter chave própria (`/configuracoes`) ou um pool
  administrado pelo admin (`/admin/[userId]`), ambos com prioridade sobre esta.

### 3. Crie o primeiro usuário admin

Sem cadastro público, o primeiro usuário precisa ser criado direto no Supabase:
**Authentication → Users → Add user** (marque "Auto Confirm User"), depois em
**Table Editor → profiles**, edite a linha criada pelo trigger e mude `role` para
`admin`. A partir daí, esse admin pode criar os demais usuários por `/admin`.

### 4. Rodar localmente

```bash
npm install
npm run dev
```

## Decisões desta fase (e o que fica para depois)

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
- **Fora do escopo desta fase** (deliberadamente): Google Sheets (export/OAuth),
  Instagram, disparo (WhatsApp/e-mail/LinkedIn), automações agendadas, contas de
  teste/trial. O schema já reserva espaço para isso sem exigir migração destrutiva
  depois.

## Estrutura

```
src/
  app/
    login/                   página de login
    (app)/                   área autenticada (proxy.ts redireciona sem sessão)
      busca/cnpj/             busca CNPJ
      busca/maps/             busca Google Maps
      historico/               lista + detalhe de pesquisas
      configuracoes/           chave Maps própria do usuário
      admin/                   gestão de usuários/créditos/chaves
    api/                      rotas de servidor (nunca expõem chaves ao cliente)
  components/
    ui/                       componentes de base (botão, input, tabela...)
    search/ historico/ settings/ admin/ layout/
  lib/
    integrations/             Casa dos Dados e Google Maps portados do produto atual
    data/                     catálogos de CNAE, nichos e estados
    supabase/                 clientes (browser, server, admin) e sessão do proxy
    credits.ts db.ts export.ts maps-key.ts   lógica de negócio
supabase/migrations/          schema SQL
```
