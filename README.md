# Prospecção Ativa — Nova Plataforma

Reconstrução completa da plataforma de prospecção ativa em Next.js + TypeScript +
Supabase, substituindo o produto atual em Streamlit (`prospec-o-ativa`). Este
repositório é **novo e independente** — nada aqui afeta o produto em produção.

Cobre a plataforma inteira: autenticação e créditos, extração (CNPJ via Casa dos
Dados, Google Maps, Instagram e LinkedIn via Apify), disparo WhatsApp (Evolution
API e canal oficial), automações agendadas, exportação (Excel/CSV/Google Sheets),
contas de teste e administração.

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
3. `supabase/migrations/0003_fix_admin_rls_recursion.sql` (corrige uma recursão
   infinita nas políticas de RLS "admin vê tudo" — sem isso, qualquer leitura
   de `profiles` retorna erro 500. Se você já rodou 0001/0002 antes desse
   arquivo existir, rode só o 0003 agora — é seguro rodar de novo, ele só
   recria as políticas.)
4. `supabase/migrations/0004_maps_api_key_admin.sql`
5. `supabase/migrations/0005_lead_enrichment_ia.sql` (Enriquecimento de Leads via IA)
6. `supabase/migrations/0006_linkedin_extraction.sql` (busca por pessoas/decisores no LinkedIn)
7. `supabase/migrations/0007_flow_automations.sql` (construtor de fluxos)
8. `supabase/migrations/0008_email_dispatch.sql` (disparo por e-mail via Resend)

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
- `APIFY_API_KEY` — busca Instagram, busca LinkedIn e fallback de Google Maps.
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — conectar Google Sheets.
- `EVOLUTION_API_URL` / `EVOLUTION_API_KEY` — disparo WhatsApp (canal não-oficial).
- `DATAFY_API_BASE_URL` — canal oficial do WhatsApp (tem um padrão razoável, só
  precisa mudar se usar outro provedor).
- `RESEND_API_KEY` — disparo por e-mail. O domínio usado em cada remetente
  cadastrado em `/disparo-email` precisa estar verificado no dashboard da
  Resend (Domains → Add Domain) antes do primeiro envio.

Enriquecimento de Leads via IA não tem variável de ambiente nenhuma: fica
desativado por padrão, admin libera por usuário (`/admin`), e cada usuário
cadastra a própria chave OpenAI em Configurações — o custo da IA é do
usuário, não da plataforma. Roda em background pelo worker (não na mesma
requisição HTTP da busca), então também depende do worker estar rodando
(ver seção "Deploy" abaixo).

Busca por LinkedIn também fica desativada por padrão (mesmo padrão do
Enriquecimento via IA — admin libera por usuário em `/admin`) e reaproveita a
mesma chave/pool Apify já usada pelo Instagram; não precisa de credencial
própria. Usa o ator `harvestapi/linkedin-profile-search` em modo `Full`
(sem busca de e-mail, que custa 2.5x mais e não é garantida) — schema de
input/output conferido direto no Apify Console, ver comentário no topo de
`src/lib/integrations/linkedin.ts`.

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
- **Templates do canal oficial e monitoramento de planilha (`sheet_watch`)**:
  a UI de disparo agora cobre os dois (painel de templates em `/disparo`, card
  "Monitorar planilha" no detalhe da campanha) — rota de API, worker e tela
  todos ligados. Etapa de cadência pode ser texto livre ou template aprovado.
- **Construtor de fluxos (`/automacoes` → "Fluxos")**: canvas visual estilo
  N8N/Make (`@xyflow/react`) pra combinar livremente módulos de gatilho,
  extração, enriquecimento, disparo e destino — sem combinações pré-definidas,
  o usuário monta o grafo que quiser. Não substitui as "Automações antigas"
  (mantidas intocadas, seção separada na mesma página): é um sistema novo,
  em paralelo, pra tudo que for criado daqui pra frente. Arquitetura: grafo
  (`nodes`/`edges`) guardado como JSONB em `automation_flows`, executado nó a
  nó por `worker/flow-tick.ts` (novo 5º tick do worker, 20s) via
  `src/lib/flow/flow-engine.ts` — que só orquestra, reaproveitando sem
  alteração as mesmas funções de extração/enriquecimento/disparo/export das
  buscas avulsas (ver adaptadores finos em `src/lib/flow/executors/`). Nó de
  IA e de disparo WhatsApp são assíncronos (`aguardando_subprocesso`): o motor
  cria o `enrichment_run`/inscreve na campanha e só verifica o andamento nos
  ticks seguintes, sem reimplementar esse processamento. Disparo por e-mail
  aparece na paleta como módulo "em breve" (sem infra de envio ainda) —
  decisão explícita de representar o que está no roadmap em vez de omitir.
  v1 é um grafo linear (1 conexão de saída por nó, sem condicionais).
- **Fluxos — paridade de filtros e onde os dados enriquecidos vão parar**:
  rodada de expansão depois do feedback de que os nós de extração tinham
  bem menos opções que as buscas avulsas correspondentes, e de que não
  ficava claro onde o resultado do enriquecimento era usado. CNPJ/Maps/
  Instagram/LinkedIn agora têm os mesmos filtros dos formulários avulsos
  (CNAEs múltiplos, porte, Simples/MEI, datas, capital, tipo de telefone,
  múltiplas cidades/UFs, catálogo de nicho, tipo seguidores/seguindo,
  indústrias do LinkedIn por ID — bug real corrigido: o campo aceitava
  texto livre, mas `buscarLinkedIn()` espera IDs numéricos do catálogo).
  Onde os dados enriquecidos vão: o resultado do nó `enriquecimento_ia` é
  mesclado DE VOLTA nos próprios leads do lote (campos `enriquecimento_*`,
  ver `src/lib/flow/enrichment-merge.ts`) — não fica isolado numa tabela à
  parte como no uso avulso de `/enriquecimento`. Isso resolve as duas
  perguntas de uma vez: os dados ficam nos mesmos leads, e vão pra
  qualquer planilha que o `destino_sheets` seguinte apontar (a mesma de
  origem, se for o caso, ou uma nova) — esse nó agora exporta colunas
  dinâmicas (`exportarGenerico()` em `google-sheets.ts`), não só o
  conjunto fixo do export avulso. Três módulos novos, pra dar mais
  customização real (não templates): `enriquecimento_maps` (generaliza o
  `mapsModo` que só existia embutido na busca CNPJ — cruza QUALQUER lote
  com o Google Maps), `filtro_leads` (reduz o lote por uma condição
  simples — sem violar a regra de grafo linear, já que só filtra, não
  ramifica) e `espera` (pausa assíncrona entre nós, mesmo padrão multi-tick
  do enriquecimento).
- **Fluxos — variáveis (estilo Make/N8N)**: escopo enxuto, compatível com o
  motor rodar cada nó uma vez por execução (não uma vez por lead). O
  gatilho manual ganha um formulário de parâmetros de entrada (chave +
  rótulo + valor padrão, editado no próprio nó); a cada "Executar agora" o
  usuário pode sobrescrever esses valores. Em qualquer campo de texto dos
  nós seguintes: `{{variaveis.chave}}` interpola o valor de entrada, e
  `{{lead.campo}}` interpola um campo do PRIMEIRO lead do lote atual (útil,
  por ex., pra nomear a aba de destino com a UF do lote extraído). A
  interpolação acontece uma vez só, em `flow-engine.ts` logo antes de
  chamar o executor (`src/lib/flow/interpolation.ts`) — nenhum executor
  precisa saber que isso existe, sempre recebem config já resolvida. Token
  que não resolve (variável não declarada, lote ainda vazio) fica intacto
  no texto em vez de virar string vazia silenciosamente. Gatilhos
  automáticos (agendado, filtro de leads, planilha) não têm formulário de
  entrada — `{{variaveis.x}}` fica sem resolver nesses casos.
- **Fluxos — descoberta de variáveis e personalização de mensagem no
  disparo**: resposta ao feedback de que não dava pra saber quais nomes de
  variável existiam sem adivinhar. O painel de configuração de qualquer nó
  pós-gatilho agora mostra um card "Variáveis disponíveis" de verdade
  (`VariaveisDisponiveis` em `flow-node-config-panel.tsx`): as variáveis
  declaradas no gatilho manual (via `flow-canvas.tsx`, que acha o nó
  `gatilho_manual` e repassa seu `config.variaveis`) e um cheat-sheet de
  campos comuns de lead agrupado por origem (`lead-field-reference.ts`) —
  cada token é um botão que copia `{{variaveis.x}}`/`{{lead.campo}}` pra
  área de transferência. O nó `disparo_whatsapp` ganhou uma nota explicando
  a conexão com `/disparo`: a mensagem em si (texto livre ou parâmetros de
  template) é editada na campanha, não no nó do fluxo, com sintaxe própria
  — `{{campo}}` direto, sem o prefixo `lead.` (convenção antiga do
  `dispatch-tick.ts`, mantida como está) — e todos os campos do lead nesse
  ponto do fluxo, inclusive os de enriquecimento, já chegam lá via
  `lead_snapshot` (nenhum código novo — o merge-back do enriquecimento já
  cobria isso).
- **Disparo — corrige gap real: parâmetros de template nunca eram
  coletados**: achado ao revisar o item acima. A API já aceitava
  `parametros_template`/`variaveis` de ponta a ponta, mas a UI de
  `/disparo` nunca preenchia esses campos — todo envio de template no canal
  oficial saía com `{{1}}`, `{{2}}`... sem valor nenhum. Corrigido:
  `dispatch-template-shared.ts` extrai os números `{{N}}` do corpo do
  template; `templates-panel.tsx` deriva e salva `variaveis` ao criar; e o
  formulário de etapa em `campaign-detail.tsx` agora mostra um campo por
  parâmetro detectado (cada um aceitando `{{campo}}` do lead, resolvido em
  `renderizarMensagem()` como já acontecia pro modo texto livre) e envia
  `parametrosTemplate` de verdade ao criar a etapa.
- **Fluxos — galeria de templates**: catálogo estático (`src/lib/flow/
  templates.ts`, sem tabela nova — mesmo padrão de `NICHOS`/`CNAES`) com 8
  fluxos prontos cobrindo toda extração (CNPJ, Maps, Instagram, LinkedIn,
  histórico), todo tipo de gatilho, os dois enriquecimentos e os nós de
  controle (filtro, espera) — da busca agendada mais simples ao funil
  completo (Maps → IA → filtro → WhatsApp, com cidade/UF como variável de
  entrada, pra rodar o mesmo fluxo em qualquer praça sem editar nada).
  Exibidos em `/automacoes` (`flow-templates-gallery.tsx`); escolher um leva
  pra `/automacoes/fluxos/novo?template=<id>`, que só pré-popula o canvas —
  nada é gravado até o usuário clicar Salvar. Campos que dependem do
  usuário (qual planilha, campanha, CNAEs, pesquisa do histórico) ficam
  vazios de propósito, sinalizados pelo mesmo alerta de "nó incompleto" que
  qualquer fluxo criado do zero já tem.
- **Disparo — auditoria completa e correção de 5 gaps reais**: revisão de
  ponta a ponta (schema, worker, integrações, rotas de API, UI) pedida
  explicitamente depois da rodada de fluxos, antes de começar a automação
  de e-mail. Achados e correções:
  - **IDOR em `instanceId`**: criar campanha/template aceitava qualquer
    `instanceId` no corpo sem checar se pertencia ao usuário — RLS só
    protege a linha nova (`user_id = auth.uid()`), não valida se um FK
    referenciado nela é de outro dono. Corrigido com
    `instanciaPertenceAoUsuario()` (`dispatch-db.ts`), chamada nas duas
    rotas de criação; erro genérico "não encontrada" pra não vazar a
    existência de instâncias de terceiros.
  - **Opt-out nunca gravava nada**: `dispatch_opt_outs` existia no schema
    desde o início mas nada escrevia nela — não havia jeito de um lead sair
    de uma campanha ativa antes do fim da cadência. Nova rota `DELETE
    /api/dispatch/campaigns/[id]/targets/[targetId]` marca o alvo como
    `removido`, registra o opt-out e cancela pendências do mesmo telefone
    em qualquer outra campanha ativa do mesmo dono (senão o opt-out valeria
    só pra inscrições futuras). Botão "Remover" na lista de alvos.
  - **`midia_url` nunca era lido**: coluna existe desde a migration inicial,
    mas toda etapa saía como texto puro mesmo com mídia configurada.
    Adicionado `enviarMidia()`/`tipoMidiaPorUrl()` em `evolution-api.ts`
    (`/message/sendMedia`, mesma ressalva de payload não confirmado contra
    servidor real que as outras integrações do projeto já têm) e
    `enviarEtapaEvolution()` agora escolhe mídia vs. texto conforme o
    campo. Campo de URL na UI, só pro canal Evolution — mídia do canal
    oficial é outro mecanismo (HEADER do template, aprovado pela Meta),
    fora de escopo aqui.
  - **`limite_diario_envios` nunca era aplicado**: coluna configurável na
    criação da instância, mas sem nenhum efeito na fila. `worker/
    dispatch-tick.ts` agora conta envios com sucesso desde a meia-noite
    (`contarEnviosHojeInstancia()`) antes de reivindicar um alvo, e pula a
    instância se o limite foi atingido. Campo de limite adicionado ao
    formulário de nova instância.
  - **Canal oficial permitia escolher "texto livre"**: a UI de etapa
    sempre mostrava as duas opções, mas `enviarEtapaOficial()` sempre
    lança erro sem `template_id` — qualquer etapa oficial criada sem trocar
    manualmente pra "Template aprovado" falhava em 100% dos envios.
    Removida a opção do seletor pro canal oficial (só "Template aprovado"
    é oferecido); `modoMensagem` passou a ser derivado direto de
    `canalOficial`, não mais um estado independente.
- **Disparo por e-mail (Resend)**: espelha a arquitetura do disparo
  WhatsApp o mais fielmente possível — mesmas tabelas-espelho
  (`email_senders`/`email_campaigns`/`email_templates`/
  `email_cadence_steps`/`email_targets`/`email_messages_log`/
  `email_sheet_watchers`/`email_opt_outs`, migration
  `0008_email_dispatch.sql`), mesmo padrão de gate (`profiles.
  email_disparo_habilitado`, flag própria — não reaproveita
  `disparo_habilitado`) e checagem de IDOR (`senderPertenceAoUsuario()`,
  mirror de `instanciaPertenceAoUsuario()`) em `src/lib/
  email-dispatch-db.ts`, e o nó `disparo_email` do construtor de fluxos
  (antes um placeholder "em breve") agora ativado de verdade, com o mesmo
  padrão "só inscreve, quem envia é o worker" de `disparo_whatsapp`.
  Diferenças deliberadas do canal: sem conceito de "instância conectada"
  — a Resend é uma única API key da plataforma (`RESEND_API_KEY`), então
  `email_senders` só guarda nome/from/reply-to + limite diário, sem
  QR/status de conexão; sem aprovação de template (não existe processo
  tipo Meta pra e-mail) — `email_templates` cai pros campos essenciais e
  ganha `assunto`; envio em LOTE via `/emails/batch` da Resend (até 20
  alvos por campanha por tick, `claim_email_targets` reivindica em lote
  por campanha em vez de 1 por instância) — por isso `intervalo_min_seg`/
  `intervalo_max_seg` de `email_campaigns` pausam entre LOTES, não entre
  mensagens individuais, e o tick roda a cada 20s (`worker/
  email-dispatch-tick.ts`, novo 6º+7º tick do worker, junto com o
  sheet-watch/auto-trigger de e-mail a cada 120s). Opt-out é tabela
  própria (`email_opt_outs`, mesmo padrão de `dispatch_opt_outs`) com
  rota pública de descadastro (`GET`/`POST` em `/api/email-dispatch/
  unsubscribe?target=<id do alvo>` — o próprio UUID do alvo é o token,
  sem tabela de token separada; GET só mostra a confirmação, POST efetiva
  o opt-out, pra não descadastrar sozinho por causa de scanner de link
  corporativo que pré-busca todo link de um e-mail via GET). Fora de
  escopo nesta v1, deliberadamente: anexos (equivalente a `midia_url`) e
  ingestão de webhook de bounce/complaint da Resend pra opt-out
  automático — ambos ficam como follow-up natural. UI nova em
  `/disparo-email` (mesma estrutura de abas de `/disparo`: Remetentes,
  Campanhas, Templates, Relatórios) e `src/components/email-dispatch/`.

## Estrutura

```
src/
  app/
    login/                    página de login
    (app)/                    área autenticada (proxy.ts redireciona sem sessão)
      busca/cnpj|maps|instagram|linkedin/  as quatro buscas
      historico/                lista + detalhe de pesquisas
      automacoes/                buscas agendadas + construtor de fluxos (fluxos/novo, fluxos/[id])
      disparo/                   instâncias, campanhas, cadência, solicitação de canal oficial
      configuracoes/              chaves próprias (Maps, Apify) e Google Sheets
      admin/                      usuários, créditos, chaves administradas, canal oficial
    api/                       rotas de servidor (nunca expõem chaves ao cliente), incl. flows/
  components/
    ui/                        componentes de base (botão, input, tabela...)
    search/ historico/ settings/ admin/ layout/ dispatch/ automations/ flows/
  lib/
    integrations/              Casa dos Dados, Google Maps, Apify, Instagram, LinkedIn, Sheets, Evolution API, WhatsApp oficial
    data/                      catálogos de CNAE, nichos, estados e indústrias LinkedIn
    supabase/                  clientes (browser, server, admin) e sessão do proxy
    credits.ts db.ts export.ts maps-key.ts apify-key.ts    lógica de negócio de extração
    dispatch-db.ts automation-db.ts automation-logic.ts automation-runner.ts   disparo e automações
    flow/                      construtor de fluxos: node-types, flow-engine, executors/
worker/                        processo de background (automações, disparo, enriquecimento IA, fluxos)
supabase/migrations/           schema SQL (0001 Fase 0 · 0002 plataforma completa · 0003–0007 incrementais)
```
