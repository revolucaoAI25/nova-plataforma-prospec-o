# Leadmatic — Nova Plataforma

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
9. `supabase/migrations/0009_linkedin_dispatch.sql` (disparo por LinkedIn via Unipile)
10. `supabase/migrations/0010_email_domains.sql` (verificação de domínio por usuário, disparo por e-mail)
11. `supabase/migrations/0011_email_domains_global_unique.sql` (corrige falha de segurança multi-tenant — ver "Decisões de arquitetura")
12. `supabase/migrations/0012_bigdatacorp_enrichment.sql` (enriquecimento de leads por CNPJ via BigDataCorp)
13. Em seguida, `0013` a `0033`, sempre em ordem numérica. Destaques:
    `0028_seguranca_profiles.sql` (fecha escalonamento de privilégio — ver
    "Decisões de arquitetura") e `0029_limpeza_legado.sql` (remove colunas e
    tabelas antigas e conserta `platform_settings`). Rode a `0029` **depois**
    do deploy do código desta versão: o código antigo ainda lia as colunas
    que ela apaga. `0030_onboarding.sql` cria as tabelas do onboarding com
    presets; `0031_funil_automatico.sql` adiciona papéis às colunas do funil,
    chaves de contato nos cards e o status "respondeu" nos alvos de disparo.
    `0032_ritmo_ab_status.sql` traz ritmo de envio (limite de leads novos
    por dia, janela de horário e dias), teste A/B por etapa e as colunas de
    entregue/lido/clicado/devolvido nos logs. `0033_dados_cliente.sql`
    adiciona nome, telefone e empresa ao perfil e faz todo perfil novo nascer
    como `user` (o papel não vem mais do metadata do cadastro). Todas podem ser rodadas de
    novo sem erro (usam `if not exists` / `create or replace`).

Em **Authentication → Providers**, deixe E-mail/senha habilitado (é o único método
usado no login). Contas são criadas pelo admin — não há cadastro público. Em
**Authentication → Sign In / Providers**, desligue *Allow new users to sign
up*: a chave anon é pública, e com o cadastro aberto qualquer um cria conta
direto pela API do Supabase (sem créditos nem recursos, mas cria).

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
- `RESEND_API_KEY` — disparo por e-mail. Cada usuário verifica o próprio
  domínio direto em `/disparo-email` → aba "Domínios" (a plataforma cria o
  domínio na conta Resend via API e mostra os registros DNS na nossa UI —
  nada de dashboard da Resend pro cliente). Um remetente só pode ser criado
  com endereço em domínio já verificado — ver "Decisões de arquitetura"
  abaixo.
- `UNIPILE_DSN` / `UNIPILE_API_KEY` — disparo por LinkedIn. Além da chave,
  exige registrar dois webhooks manualmente (uma vez, no dashboard da
  Unipile ou via `criarWebhook()`) — ver comentário no `.env.example`.
  `UNIPILE_WEBHOOK_SECRET` é obrigatório para os webhooks funcionarem:
  protege esses endpoints públicos com um segredo na própria URL e, sem
  ele, eles recusam tudo — ver "Decisões de arquitetura".
- `BIGDATACORP_TOKEN_ID` / `BIGDATACORP_ACCESS_TOKEN` — enriquecimento de
  leads por CNPJ (sócios/quadro societário + telefone/e-mail registrados),
  disponível em `/enriquecimento` → aba "Sócios e Contato", como extra
  opcional na busca CNPJ e como nó no construtor de fluxos. Chave única da
  plataforma (custo absorvido pela plataforma, não por usuário) — ver
  "Decisões de arquitetura".

Enriquecimento de Leads via IA não tem variável de ambiente nenhuma: fica
desativado por padrão, admin libera por usuário (`/admin`), e cada usuário
cadastra a própria chave OpenAI em Configurações — o custo da IA é do
usuário, não da plataforma. Roda em background pelo worker (não na mesma
requisição HTTP da busca), então também depende do worker estar rodando
(ver seção "Deploy" abaixo).

Busca por LinkedIn também fica desativada por padrão (mesmo padrão do
Enriquecimento via IA — admin libera por usuário em `/admin`) e reaproveita a
mesma chave Apify já usada pelo Instagram; não precisa de credencial
própria. Usa o ator `harvestapi/linkedin-profile-search` em modo `Full`
(sem busca de e-mail, que custa 2.5x mais e não é garantida) — schema de
input/output conferido direto no Apify Console, ver comentário no topo de
`src/lib/integrations/linkedin.ts`.

Essas chaves de fornecedor (Casa dos Dados, Google Maps, Apify) são sempre da
plataforma: cadastradas em `/admin` → Chaves da plataforma, com a variável de
ambiente como fallback (`src/lib/platform-keys.ts`). O usuário final só
configura a chave da OpenAI, em Conexões.

### 3. Crie o primeiro usuário admin

Sem cadastro público, o primeiro usuário precisa ser criado direto no Supabase:
**Authentication → Users → Add user** (marque "Auto Confirm User"), depois em
**Table Editor → profiles**, edite a linha criada pelo trigger e mude `role` para
`admin`. A partir daí, esse admin cria os demais usuários por `/admin`.

### Recuperação de senha

A tela de login tem "Esqueci minha senha" (`/redefinir-senha`). O link
enviado pelo Supabase volta por `/auth/confirmar`, então cadastre
`{NEXT_PUBLIC_APP_URL}/auth/confirmar` em Authentication → URL
Configuration → Redirect URLs. Para produção, configure um SMTP próprio
em Authentication → Emails (o envio padrão do Supabase tem limite baixo
por hora).

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
  o usuário monta o grafo que quiser. As "Automações antigas" (busca agendada)
  que conviviam com ele foram removidas depois — os fluxos cobrem o mesmo caso. Arquitetura: grafo
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
- **Disparo por LinkedIn (Unipile)**: terceiro canal de prospecção ativa —
  pedido de conexão + mensagem, focado em decisores (LinkedIn não tem API
  oficial pra isso; Unipile é um provedor terceiro que gerencia a sessão
  LinkedIn real do usuário por trás de uma API de verdade, mesmo papel que
  a Evolution API cumpre pro WhatsApp). Mesmo padrão dos outros dois
  canais — migration espelho (`0009_linkedin_dispatch.sql`), gate próprio
  (`profiles.linkedin_disparo_habilitado`), IDOR-check
  (`contaPertenceAoUsuario()`) em `src/lib/linkedin-dispatch-db.ts`, nó
  `disparo_linkedin` no construtor de fluxos — com diferenças estruturais
  reais que o canal exige:
  - `linkedin_accounts` é conceitualmente como `whatsapp_instances` (conta
    real logada, com estado de conexão/reconexão via hosted auth link da
    Unipile), não como `email_senders` (só metadados).
  - Só dá pra iniciar conversa com quem já é 1º grau — uma etapa de
    `convite` precisa ser aceita antes de uma etapa de `mensagem`
    seguinte poder disparar. Novo status de alvo `aguardando_aceite`
    cobre esse gate; liberado pelo webhook `new_relation` da Unipile (não
    é em tempo real — até ~8h de atraso é esperado do lado do LinkedIn) ou
    por um poll de reforço bem espaçado (`tickLinkedInRelationsPoll`, a
    cada 2h, seguindo a recomendação da própria doc da Unipile de não
    checar isso com frequência).
  - Fila processa 1 ação por conta por tick (`claim_linkedin_target`,
    mirror de `claim_dispatch_target` do WhatsApp), não em lote como o
    e-mail — limites diários separados pra convite/mensagem
    (`limite_diario_convites`/`limite_diario_mensagens`) e pacing bem mais
    espaçado (3-10min entre ações, default) de propósito: automação
    "rápida" no LinkedIn é o padrão que mais chama atenção de detecção de
    bot, e os ~80-100 convites/dia que a Unipile documenta como teto do
    LinkedIn são um limite da plataforma, não uma recomendação segura de
    volume de automação.
  - `provider_id` (formato que a API da Unipile exige) e `chat_id` (pra
    não duplicar conversa numa cadência de várias mensagens) são
    resolvidos sob demanda pelo worker e cacheados no próprio alvo.
  Fora de escopo nesta v1: InMail/Sales Navigator, anexos, importação em
  massa de conexões já existentes. UI em `/disparo-linkedin`
  (`src/components/linkedin-dispatch/`).
- **Verificação de domínio multi-tenant (Resend Domains API)**: gap real do
  desenho original do disparo por e-mail — `email_senders.from_email`
  aceitava qualquer endereço digitado, o que só funcionava assumindo um
  único domínio verificado manualmente no dashboard da Resend pelo admin da
  plataforma. Não escala pra multiusuário: cada cliente precisa mandar do
  próprio domínio, e não tem (nem deve ter) acesso à conta Resend da
  plataforma. Corrigido com a própria Domains API da Resend, que é feita
  pra esse exato cenário (múltiplos domínios sob uma única conta/API key):
  `criarDominioResend()`/`listarDominiosResend()`/`verificarDominioResend()`/
  `deletarDominioResend()` em `src/lib/integrations/resend.ts` chamam
  `POST/GET/POST verify/DELETE /domains`, sempre com a mesma
  `RESEND_API_KEY` da plataforma — nunca uma conta por cliente. Nova tabela
  `email_domains` (migration `0010_email_domains.sql`, `user_id` +
  `dominio` + `status` + `records` jsonb com os registros DNS retornados
  pela Resend) guarda um domínio por usuário; `criarDominioEmail()` em
  `src/lib/email-dispatch-db.ts` reconcilia com o que já existe na conta
  Resend antes de criar (evita duplicar o `revolucao-ai.com`, que já foi
  verificado manualmente antes desse fluxo existir). Os registros DNS são
  mostrados na nossa própria UI (`/disparo-email` → aba "Domínios") pro
  usuário copiar pro provedor DNS dele — nunca expõe o dashboard da Resend.
  `dominioVerificadoPeloUsuario()` passou a ser checado em
  `POST /api/email-dispatch/senders` antes de aceitar um `fromEmail` novo;
  `senders-panel.tsx` trocou o campo de e-mail livre por um seletor de
  domínio verificado + parte local do endereço.
  **Correção de segurança pós-lançamento** (migration
  `0011_email_domains_global_unique.sql`): a reconciliação original
  confiava cegamente no status que a Resend devolvia pra QUALQUER domínio
  já existente na conta compartilhada — como a conta é uma só pra todos os
  usuários, um usuário B que digitasse um domínio que o usuário A já tinha
  verificado (ex: o `revolucao-ai.com` da própria plataforma) herdava
  `status: verified` na hora, sem provar posse do DNS, e podia criar
  remetente `qualquercoisa@dominiodeoutrem.com`. Corrigido trocando a
  constraint de `UNIQUE(user_id, dominio)` pra `UNIQUE(dominio)` global — um
  domínio só pode pertencer a UM usuário na tabela inteira — e
  `criarDominioEmail()` agora rejeita explicitamente
  (`DominioJaRegistradoError`, HTTP 409) quando o domínio já é de outro
  usuário, em vez de reconciliar o status.
- **Auditoria de disparo por e-mail/LinkedIn pós-lançamento**: revisão
  completa de `email-dispatch-db.ts`/`linkedin-dispatch-db.ts`/workers/rotas
  depois que o usuário configurou Resend e Unipile em produção, encontrou
  mais 3 problemas reais além do de domínio acima: (1) campanhas de
  LinkedIn no modo "gatilho automático" (sem planilha) nunca inscreviam
  nenhum alvo — `buscarLeadsFiltro()` (`src/lib/dispatch-db.ts`, reaproveitada
  dos 3 canais) não selecionava a coluna `linkedin_url`, então todo lead
  chegava em `enrollLinkedInTargets()` sem URL e era descartado como
  inválido, silenciosamente, sem erro no log — corrigido incluindo a coluna
  no `select()`. (2) os dois webhooks públicos da Unipile
  (`/api/linkedin-dispatch/webhooks/unipile/{account-status,relations}`)
  aceitavam qualquer POST sem verificar origem (a Unipile não documenta
  assinatura de payload) — mitigado com um segredo compartilhado na própria
  URL (`UNIPILE_WEBHOOK_SECRET`, checado por `webhookSegredoValido()` em
  `unipile.ts`; opcional, mas recomendado — sem ele o endpoint só loga um
  aviso e segue aceitando, comportamento antigo). (3) dois ajustes menores
  de qualidade de log: envio de e-mail em lote não marcava mais "sucesso"
  um item que a Resend não confirmou na resposta do `/emails/batch`
  (`worker/email-dispatch-tick.ts`); log de falha do LinkedIn não gravava
  mais `tipo_acao: "convite"` fixo quando a campanha estava inativa e a
  etapa real do alvo era "mensagem" (`worker/linkedin-dispatch-tick.ts`,
  corrigido computando a etapa antes de checar se a campanha está ativa).
- **Enriquecimento de leads por CNPJ (BigDataCorp)**: terceira via de
  enriquecimento, ao lado da IA — em vez de partir de nome/e-mail/telefone
  e buscar na web de forma especulativa (IA), consulta o CNPJ direto em
  bases de registro (Receita Federal e outras fontes via BigDataCorp):
  sócios/quadro societário e telefone/e-mail cadastrados da empresa —
  contato de decisor de verdade, não um perfil scrapeado. Só funciona
  quando o CNPJ já é conhecido — não se aplica a leads de Google Maps (que
  nunca vêm com CNPJ), diferente da busca CNPJ e de qualquer lote que já
  tenha cruzado com CNPJ antes; construído de forma genérica ("qualquer
  lote com `cnpj` preenchido") em vez de travado numa fonte, então compõe
  naturalmente se isso mudar no futuro. Chave ÚNICA da plataforma por
  enquanto (`BIGDATACORP_TOKEN_ID`/`BIGDATACORP_ACCESS_TOKEN`, custo
  absorvido pela plataforma — decisão explícita do usuário até pensarem
  num modelo de chave por cliente/plano). Mesmo padrão assíncrono do
  enriquecimento via IA (`bigdatacorp_enrichment_runs`/`_leads`, migration
  `0012_bigdatacorp_enrichment.sql`, worker a cada 10s) — tabelas
  próprias, não reaproveita `enrichment_runs` (entrada/saída diferentes).
  Endpoint único `POST /empresas` da BigDataCorp, combinando os datasets
  `basic_data` + `registration_data` + `dynamic_qsa_data` numa chamada só
  por CNPJ (`src/lib/integrations/bigdatacorp.ts`). Ressalva: o dataset de
  sócios/QSA teve o nome técnico inferido de uma referência indexada — a
  página de doc específica não carregou durante a pesquisa, então a
  estrutura exata da resposta não foi 100% confirmada; a resposta bruta
  fica guardada em `extras` (jsonb) como rede de segurança, e o parsing
  (`extrairSocios()`) é defensivo — ajustar assim que o primeiro resultado
  real chegar, se o formato divergir. Disponível em três lugares que
  compartilham a mesma infra: aba dedicada em `/enriquecimento` (cola uma
  lista de CNPJs), extra opcional na busca avulsa de CNPJ (cria uma
  execução em background pros CNPJs encontrados), e nó
  `enriquecimento_bigdatacorp` no construtor de fluxos — os três só criam
  a run; quem processa é sempre o mesmo worker tick. O merge de volta no
  lote de um fluxo (`mesclarBigDataCorpNoLote()`) casa por CNPJ (chave
  exata, ao contrário do merge da IA que precisa de heurística por
  e-mail/telefone/nome) e retroalimenta `telefone`/`email` do lead quando
  estavam vazios — isso é o que deixa o contato do sócio pronto pro
  disparo (WhatsApp/e-mail) sem exigir que quem monta o fluxo saiba que
  existe um campo separado.
- **Nomes de fornecedor nunca aparecem pro usuário final**: decisão
  explícita do usuário — a plataforma nunca deve revelar, em texto
  visível na UI (labels, descrições, mensagens de erro/aviso, títulos de
  aba), qual ferramenta de terceiro resolve cada funcionalidade. O usuário
  vê "Google Maps"/"Google Sheets" (produtos que ele mesmo conecta/usa
  diretamente, não infraestrutura escolhida por trás) e conceitos
  genéricos como "CNPJ" ou "Sócios e Contato" — nunca "Casa dos Dados",
  "Apify", "BigDataCorp", "Resend", "Unipile" ou "Evolution API". Esse
  texto só existe em código (nomes de variável/função/tabela/tipo,
  comentários, rotas de API) e no README — não é onde o cliente olha.
  **Exceção deliberada**: a chave da OpenAI (Enriquecimento via IA)
  continua nomeada como tal em Configurações, porque o próprio usuário
  precisa criar a conta e gerar a chave direto em platform.openai.com —
  esconder o nome ali quebraria a instrução, não protegeria infraestrutura
  nenhuma. **Escopo deliberado**: páginas de admin (`/admin/*`,
  `admin-keys-form.tsx`, coluna de flag em `admin-users-table.tsx`) foram
  deixadas com nome de fornecedor — só a equipe da própria plataforma
  acessa essas telas, então o nome ali ajuda a debugar/dar suporte em vez
  de revelar algo pro cliente.
- **Entrada de leads unificada — colar/upload/histórico**: o Enriquecimento
  por CNPJ ganhou paridade com o Enriquecimento via IA na forma de
  alimentar a lista (antes só tinha um textarea cru pra colar CNPJ) —
  `BigDataCorpLeadStagingEditor` (mirror de `LeadStagingEditor`, que já
  existia só pra IA) com três abas: colar texto, upload de planilha
  (reaproveita `POST /api/enrichment/parse-upload`, cujo gate foi
  ampliado pra aceitar `bigdatacorp_enrichment_habilitado` além de
  `enriquecimento_ia_habilitado` — o parser em si é genérico, nunca foi
  específico da IA) e **puxar de uma pesquisa do histórico** — opção nova
  nos dois enriquecimentos, via `GET /api/historico/[id]/leads` (novo,
  RLS cuida do isolamento por usuário). No enriquecimento por CNPJ o
  seletor de pesquisas só lista as de fonte `cnpj` (é a única fonte que
  preenche `leads.cnpj`); no enriquecimento via IA lista qualquer fonte,
  filtrando client-side quem tem e-mail ou telefone.
- **Pool único de créditos** (migration `0013_unified_credits.sql`):
  substitui as 4 carteiras separadas (`cdd_credits`/`maps_credits`/
  `instagram_credits`/`linkedin_credits`), que antes debitavam todas a 1
  crédito por lead sem relação com o custo real de cada fornecedor por
  trás. Agora é um saldo único (`profiles.creditos`) e cada ação tem um
  peso em `credit_costs` (tabela, não hardcoded — admin edita em
  `/admin`, sem precisar de deploy quando o preço de um fornecedor muda),
  calculado com base no custo real de mercado levantado com o usuário: 1
  crédito ≈ R$0,005 (Casa dos Dados, a fonte mais barata). Busca CNPJ = 1
  crédito; verificação extra de Maps na busca CNPJ = +5; Maps avulso = 5;
  Instagram = 1; LinkedIn = 12 (a Apify cobra ~$100/1000 páginas de busca
  + $4-10/1000 perfis — de longe o canal mais caro); enriquecimento
  BigDataCorp = 40 (consulta sempre os 3 datasets — cadastro, contato e
  sócios/QSA — numa chamada só, não existe modo "só básico" mais barato
  pra oferecer separado hoje). `debitarCreditos()` em `src/lib/credits.ts`
  busca o custo da ação (cacheado 60s em memória do processo) e debita
  `quantidade × custo` via a RPC `decrement_creditos`. As 4 colunas
  antigas continuam na tabela como registro histórico — nada no código
  novo lê ou escreve nelas. Ficaram fora do pool por decisão explícita do
  usuário: **Resend** (disparo e-mail) — não é cobrado por lead aqui, a
  ideia é um limite mensal de envios por conta/plano, não implementado
  ainda; **Unipile** (disparo LinkedIn) — não escala por mensagem (é
  assinatura fixa por conta conectada, ~€49/mês), não faz sentido
  transformar em crédito por ação, pensado como módulo add-on separado;
  **Evolution API** (WhatsApp não-oficial) — self-hosted, custo zero;
  **OpenAI** (enriquecimento via IA) — BYOK, cada cliente usa a própria
  chave.
- **Busca avulsa de Maps: só Apify, Google Maps API oficial removida**
  (migration `0014_credit_costs_maps_apify.sql`, decisão explícita do
  usuário — a API oficial do Google custa bem mais caro que o scraping via
  Apify pro mesmo resultado). `/api/search/maps`, o executor
  `extracao-maps.ts` e a automação antiga (`automation-runner.ts`, tipo
  `maps`) agora chamam só `buscarApifyMaps` — removida a lógica de
  Google-primário-com-fallback-Apify (`resolverChaveMaps`,
  `resolverChaveMapsOverflow`, `buscarMaps`). O peso de `maps` em
  `credit_costs` já estava calculado em cima do preço da Apify desde a
  migration 0013, então não mudou. **Limitação real, não resolvida**: a
  verificação de telefone/site via Maps embutida na busca por CNPJ
  (`enriquecerComMaps`, checkbox de Maps na busca CNPJ) e o nó de fluxo
  `enriquecimento_maps` continuam na API oficial do Google — eles fazem 1
  lookup específico por lead dentro do ciclo de uma requisição HTTP
  síncrona (até centenas de leads por busca), e o scraper da Apify roda
  como job assíncrono (minutos por run), então não dá pra trocar sem
  reconstruir esse fluxo como assíncrono (padrão de
  `bigdatacorp-enrichment-tick.ts`) — não feito aqui. O peso de
  `cnpj_maps_extra` estava calculado como se já fosse Apify (5 créditos)
  e foi corrigido pro custo real da API oficial (~55 créditos/lead
  verificado — Text Search + Place Details com telefone/site).
- **Funil (Kanban) integrado ao construtor de fluxos** (migration
  `0015_funis.sql`): visão de pipeline sobre leads já extraídos —
  `funis` → `funil_colunas` (ordenadas, cada uma com um `fluxo_id`
  opcional) → `funil_cards` (1 por lead, guarda `lead_snapshot` — sobrevive
  mesmo se o lead original em `leads` for apagado). Integração nas duas
  direções, deliberadamente assimétrica pra evitar loop: (1) **Fluxo →
  Funil**, o nó `destino_funil` deposita o lote numa coluna, sem disparar
  o fluxo configurado nela; (2) **Funil → Fluxo**, só o **arraste manual**
  de um card (endpoint `PATCH /api/funis/[id]/cards/[cardId]`) dispara o
  `fluxo_id` da coluna de destino — via `criarRunDoFluxo` do próprio motor
  de fluxos (`src/lib/flow/flow-engine.ts`), passando o lead movido como
  `lote` de 1 item, sem checar `temRunAtiva` (cada card é uma run
  independente, concorrência entre cards é esperada). Sem gate/flag nova —
  disponível pra todo usuário, como Histórico. Leads entram no funil de
  duas formas: pelo botão "Adicionar ao Funil" em `/historico/[id]` (a
  pesquisa inteira, mesma granularidade do "puxar do histórico" já usado
  nos enriquecimentos) ou pelo nó de fluxo. Board com drag-and-drop nativo
  (HTML5 `draggable`, sem biblioteca nova).
- **Modo claro + hierarquia de elevação** (`src/app/globals.css`): escuro
  continua sendo o tema padrão/histórico — quem nunca clicou no toggle
  não vê nada diferente. Claro é opt-in, construído do zero pra fundo
  claro (não é um filtro de inversão) mas reaproveitando a mesma
  identidade (verde da marca): acentos de estatística (`--info`/
  `--violet`/`--amber`) usam o tom mais escuro da mesma família de cor no
  claro (ex: `--amber: #b45309` em vez de `#f5a623`) só pra manter 4.5:1
  de contraste em texto pequeno sobre branco — no escuro usam o tom mais
  vívido, que funciona melhor sobre fundo escuro (`color-dark-mode` do
  guia de design usado: tons dessaturados/claros no escuro, nunca cor
  invertida). Troca é feita via atributo `data-theme` em `<html>`,
  persistida em `localStorage` (chave `theme`) — um script inline
  síncrone no `<head>` (`src/app/layout.tsx`) aplica o tema salvo ANTES
  do 1º paint pra não piscar (FOUC); sem nada salvo, segue
  `prefers-color-scheme` do sistema operacional via `@media` em
  `globals.css`. Toggle (sol/lua) na Topbar
  (`components/layout/theme-toggle.tsx`).
  **Hierarquia**: o tema escuro tinha só 3 camadas de superfície muito
  próximas em luminosidade (`bg`/`surface`/`surface-2` quase
  indistinguíveis — card, página e input pareciam a mesma cor) — virou 4
  camadas com separação real (`bg` → `surface` → `surface-2` →
  `surface-3`, essa última pro nível mais alto: dropdown/popover/modal,
  `--color-popover` agora aponta pra `surface-3` em vez de `surface`).
  Também formalizada uma escala de sombra (`--elevation-sm/md/lg`,
  theme-aware) que substitui os valores de `shadow-[...]` soltos que
  existiam hardcoded dentro de componentes (`Card`, `Select`) — e como
  Tailwind v4 permite sobrescrever a paleta de sombra padrão dentro de
  `@theme`, as classes `shadow-sm`/`shadow-md`/`shadow-lg` do resto do
  app já usam essa escala automaticamente, sem precisar tocar em cada
  componente individualmente. Escopo deliberado desta rodada: os tokens
  compartilhados (cor, sombra, elevação) e o componente `Card` — não uma
  reescrita de cada tela; outras sombras ad hoc que sobraram (`button.tsx`,
  `switch.tsx` etc.) ficam pra uma passada futura se fizer sentido.
- **Retry automático + manual em `flow_runs`** (migration
  `0016_flow_run_retry.sql`): antes, um erro em qualquer nó marcava a run
  inteira como terminal — sem tentar de novo, mesmo pra falha claramente
  passageira (timeout, fornecedor fora do ar por um instante). Agora: erro
  → `status='aguardando_retry'` com backoff (2min, 10min, 30min — array
  `RETRY_BACKOFF_MS` em `flow-engine.ts`) até `max_tentativas` (padrão 3),
  **no mesmo nó e com o mesmo `contexto`** — não reinicia o fluxo do
  zero, só reexecuta o nó que falhou (`avancarRun` já funciona assim
  naturalmente, não precisou de um caminho separado: `avancarRuns` só
  passou a também buscar runs `aguardando_retry` cujo
  `proxima_tentativa_em` já passou). Esgotadas as tentativas automáticas,
  a run fica terminal (`erro`) mas com um botão **"Tentar novamente"** na
  UI (`FlowRunHistory`) que chama `POST
  /api/flows/[id]/runs/[runId]/retry` → `reexecutarRun()`, resetando
  `tentativas` pra 0 (novo orçamento de retry automático) e voltando pra
  `executando` no mesmo ponto. Simplificação deliberada: não distingue
  erro passageiro de permanente (ex: "chave não configurada" nunca vai se
  resolver sozinho) — todo erro entra no mesmo ciclo; o custo é só
  demorar até ~40min a mais pra reportar um erro que já era permanente,
  contra recuperar automaticamente os que eram passageiros.
- **Funil: adicionar leads direto no board** (`AdicionarLeadsDialog`, botão
  de pessoa no cabeçalho de cada coluna): antes só dava pra popular o
  Funil inteiro de uma vez a partir do Histórico. Agora, por coluna,
  4 formas — 1 lead avulso (soma direto, sem lote), colar texto, upload de
  planilha (mesmo parser de `/api/enrichment/parse-upload` já usado nos
  enriquecimentos, com detecção automática de coluna por nome), ou puxar
  uma pesquisa inteira do histórico. Mesma arquitetura do
  `BigDataCorpLeadStagingEditor` (texto colado/planilha acumulam numa
  lista editável antes de enviar em lote; histórico e o avulso enviam
  direto). `POST /api/funis/[id]/cards` passou a aceitar `leads: [...]`
  além de `searchId` (schema `zod` com `.refine` garantindo exatamente um
  dos dois).
- **Passada de profundidade visual — slider de resultados + cor de coluna
  no Funil + tabelas/listas com mais nuance de hover**: depois do modo
  claro (que tratou só os tokens compartilhados e o `Card`), esta rodada
  ataca o "tudo parece a mesma caixinha cinza" em componentes específicos.
  (1) `LimiteSlider` (`components/search/limite-slider.tsx`, sobre
  `@radix-ui/react-slider`) substitui o `<input type="number">` de "Limite
  de resultados" nos 4 formulários de busca avulsa (CNPJ, Maps, Instagram,
  LinkedIn) por uma barra arrastável com o valor atual em destaque — pedido
  explícito do usuário. (2) `funil_colunas.cor` existia no schema e na API
  desde a migration 0015 mas nunca tinha sido exposta na UI — toda coluna
  do Kanban era visualmente idêntica. Agora cada coluna tem uma tarja
  colorida no topo, uma bolinha ao lado do nome e um seletor de 8 cores no
  painel de edição; colunas sem cor explícita recebem uma por rotação de
  índice (`corDaColuna()`), então o board já nasce diferenciado sem exigir
  ação do usuário. Os cards de lead ganharam a mesma cor como borda
  esquerda (amarra visualmente card → coluna), elevação/hover real (some
  o "achatado", sobe 2px e ganha sombra) e um estado de arraste (opacidade
  + leve encolhimento) que antes não existia. (3) `Table`: cabeçalho fica
  `sticky` com leve blur, linhas pares ganham zebra sutil (`bg-secondary/20`)
  e o hover passa a usar o verde da marca (`bg-accent/50`) em vez de cinza
  genérico, pra diferenciar claramente "linha alternada" de "linha sob o
  cursor". (4) Lista de "Últimas pesquisas" no dashboard: item inteiro virou
  alvo de clique (antes só o título), com fundo e cor de destaque no hover
  e o ícone da fonte crescendo sutilmente — mesma linguagem de
  micro-interação já usada em outros componentes clicáveis do app. (5) Os
  dois cards de atalho do dashboard (CNPJ/Maps) ganharam o mesmo glow
  radial tonal que o `StatCard` já usava, intensificando no hover —
  reaproveita um padrão que já existia em vez de inventar um novo.
- **Diálogo de confirmação em vez do `confirm()` nativo do navegador**:
  auditoria de UX encontrou 17 pontos (excluir coluna do Funil, remover
  instância/template/campanha/domínio/conta, desconectar Google Sheets,
  apagar fluxo/pesquisa/execução etc.) usando `window.confirm()` — um
  popup fora do tema, sem animação, que trava a thread principal.
  `@radix-ui/react-dialog` já estava instalado mas nunca tinha sido
  usado (nem `@radix-ui/react-toast`, ainda sem uso — próxima
  oportunidade). Criado `src/components/ui/dialog.tsx` (wrapper temático,
  mesma linguagem visual do resto da UI: `rounded-3xl`, elevação
  `--elevation-lg`, animação própria `dialog-in` em vez do plugin
  `tailwindcss-animate` — que este projeto não usa, reaproveitando o
  vocabulário de keyframes já existente em `globals.css`) e
  `ConfirmProvider`/`useConfirm()` (`src/components/ui/confirm-provider.tsx`):
  um único provider no root layout resolve a promessa de qualquer
  chamador, então cada callsite só trocou
  `if (!confirm("..."))` por `if (!(await confirmar({ title: "...",
  destructive: true })))`. Ação destrutiva ganha ícone de alerta e botão
  vermelho; todas as 17 chamadas migradas.
- **Compra de créditos avulsos — Asaas** (migration
  `0017_asaas_credit_purchases.sql`): escolha explícita do usuário (conta
  já existente lá, PIX/boleto/cartão nativos, taxas boas pro público
  brasileiro — avaliamos Stripe e Mercado Pago/Pagar.me como alternativas,
  mas não havia motivo pra trocar uma conta já ativa). Fluxo: usuário
  escolhe um pacote em `/creditos` → na 1ª compra informa CPF/CNPJ (o
  Asaas exige isso pra criar um cliente; fica salvo em `profiles.cpf_cnpj`
  pras próximas) → criamos (ou reusamos) o cliente Asaas
  (`profiles.asaas_customer_id`) e uma cobrança com `billingType:
  UNDEFINED` — o pagador escolhe PIX, boleto ou cartão na própria fatura
  hospedada do Asaas (`invoiceUrl`), sem a gente precisar implementar um
  checkout customizado → usuário é redirecionado pra lá → um webhook
  (`/api/webhooks/asaas`, autenticado pelo header `asaas-access-token`
  que o próprio Asaas ecoa, configurado manualmente no dashboard deles)
  credita o pool único assim que `PAYMENT_CONFIRMED`/`PAYMENT_RECEIVED`
  chega. Decisão de segurança central: `credit_purchases` não tem policy
  de UPDATE pro usuário comum — só o webhook (via cliente admin) marca
  uma compra como paga, e `marcarCompraPaga()` é idempotente (compara e
  troca o `status` de `pendente` pra `pago` numa única query — entrega
  duplicada do webhook, que o próprio Asaas documenta como possível, não
  credita duas vezes). RPC `increment_creditos` é a irmã simétrica de
  `decrement_creditos` (0013), mesma proteção via `security definer`
  contra race condition. Pacotes (`credit_packages`) são admin-editáveis
  em `/admin` (nome, quantidade, preço, ativo/inativo) — igual
  `credit_costs`, ajustar preço não exige deploy.
- **Transparência de custo em créditos ANTES de buscar**: pedido explícito
  do usuário ("não está sendo informado quantos créditos vão ser
  gastos") — nenhum dos 4 formulários de busca avulsa mostrava o custo em
  crédito em lugar nenhum antes de rodar a busca, só depois (no saldo que
  caía). `CreditoEstimado` (`src/components/search/credito-estimado.tsx`)
  é um indicador pequeno acima do botão de buscar — "Até N créditos
  nesta busca (custo/resultado, cobrado só pelo que for encontrado)" —
  recalculado ao vivo conforme o slider de limite (e, na busca por CNPJ,
  também os toggles de verificação extra no Maps e enriquecimento
  BigDataCorp, cada um somando seu próprio custo por unidade ao total).
  Os números vêm de `credit_costs` via novo helper
  `custosVisiveis()` (`src/lib/credits.ts`) — mesma tabela que já
  alimentava o débito real, então o indicador nunca diverge do que é
  cobrado de fato. Efeito colateral de auditar isso: achamos um texto
  desatualizado no formulário de LinkedIn prometendo que "buscar e-mail"
  custava 2,5x mais créditos — a rota nunca implementou essa cobrança
  diferenciada (sempre cobrou a taxa plana), então o texto foi corrigido
  pra não prometer algo que não acontece, em vez de inventar uma nova
  camada de billing sem ser pedido.
- **Popover de informação — menos texto sempre visível, sem esconder
  nada**: pedido explícito de reduzir a densidade de texto dos
  formulários e usar mais pop-ups pra detalhes secundários. Novo
  `Popover` (`src/components/ui/popover.tsx`, sobre
  `@radix-ui/react-popover`) e `InfoPopover` (ícone "?" que abre a
  explicação sob demanda). `FieldRow` (`field-group.tsx`) ganhou a prop
  `info` — mesma posição de `description`, mas fica escondida atrás do
  ícone em vez de sempre visível; usada nos dois campos mais longos que
  existiam (Maps: "buscar telefone e site" consome cota mais restrita;
  CNPJ: o que o enriquecimento BigDataCorp faz e onde acompanhar).
  Detalhe técnico que quase virou bug: `FieldRow` usa um `<label>`
  implícito envolvendo todo o conteúdo (clicar em qualquer lugar da
  linha ativa o switch) — um botão comum dentro dele também ativaria o
  switch ao ser clicado. O trigger do `InfoPopover` chama
  `stopPropagation()` (não `preventDefault()`, que cancelaria o próprio
  clique de abrir o popover) pra nunca deixar o clique borbulhar até o
  `<label>`. O `PopoverContent` anima só opacidade, nunca `transform` —
  o Radix já usa `transform` inline pra posicionar o popover relativo ao
  gatilho (floating-ui), e uma animação CSS na mesma propriedade
  entraria em conflito e quebraria o posicionamento.
- **Correção no indicador de créditos — taxa, não total "até X"**:
  feedback do usuário depois de ver a v1 do `CreditoEstimado`: multiplicar
  o custo por unidade pelo limite escolhido gerava números grandes e
  estranhos numa busca de LinkedIn com limite alto (ex: "até 6.000
  créditos"), que não refletiam o custo real (cobrado pelo que for
  ENCONTRADO, quase sempre bem menos que o limite) e mais assustavam do
  que informavam. Trocado por só a taxa — "12 créditos por perfil —
  cobrado só pelo que for encontrado" — mais simples, mais direto, sem
  fazer conta que engana.
- **Assinatura recorrente de plano via Asaas** (migration
  `0018_asaas_subscriptions.sql`): mesma conta/API dos créditos avulsos
  (0017), agora também pra cobrança mensal — pedido explícito do usuário,
  antes de existir uma landing page própria de vendas ("por enquanto");
  quando essa LP existir, ela deve poder linkar direto pro fluxo de
  assinar aqui dentro. `POST /v3/subscriptions` com `cycle: MONTHLY` e
  `billingType: UNDEFINED` (mesma escolha de deixar o pagador decidir
  PIX/boleto/cartão na fatura). Diferente de `credit_purchases`, onde a
  gente sempre cria a linha ANTES de cobrar, as cobranças de renovação
  são geradas pelo próprio Asaas de forma assíncrona a cada ciclo — só
  sabemos que uma existe quando o webhook avisa. É o campo
  `payment.subscription` (presente só em cobranças geradas por uma
  assinatura) que diferencia uma renovação de uma compra avulsa no mesmo
  endpoint de webhook; `subscription_payments` é alimentada por INSERT
  ali (não por UPDATE como `credit_purchases`), e o próprio `unique` em
  `asaas_payment_id` garante que reentrega do webhook não credita duas
  vezes (insert conflita, `processarPagamentoAssinatura` não faz nada).
  Cada renovação confirmada credita `plans.creditos_mensais` via
  `increment_creditos` (mesma RPC dos créditos avulsos) — de quebra,
  isso finalmente dá uso real a `profiles.monthly_creditos`/
  `credits_renewed_at`, que já existiam no schema desde o produto
  original mas nunca tinham um mecanismo automático de renovação por
  trás, só edição manual pelo admin. `PAYMENT_OVERDUE` marca a
  assinatura como `inadimplente` (não credita nada, só avisa na UI).
  Trocar de plano nesta v1 é cancelar e assinar de novo — sem proration.
  **Atualização**: a decisão original de deixar o bundle de features fora
  do escopo foi revertida — ver bullet "Bundle de features por plano"
  logo abaixo.
- **Bundle de features por plano** (migration `0020_plan_feature_flags.sql`):
  pedido explícito do usuário, reverte a decisão anterior. `plans` ganha as
  mesmas 7 colunas booleanas que já existiam em `profiles`
  (`disparo_habilitado`, `instagram_visible`, `linkedin_visible`,
  `enriquecimento_ia_habilitado`, `bigdatacorp_enrichment_habilitado`,
  `email_disparo_habilitado`, `linkedin_disparo_habilitado`), configuráveis
  no popover "Recursos" de cada linha em `PlansPanel` (admin). Aplicado em
  `subscriptions-db.ts::processarPagamentoAssinatura`, só na **1ª
  ativação** de cada assinatura (checa `assinatura_status !== "ativa"`
  ANTES do update — não reaplica a cada renovação mensal) e sempre por OR:
  só liga um flag que o plano concede, nunca desliga um que já estava
  ligado. Cancelar a assinatura também não revoga nada automaticamente —
  revogar continua manual pelo admin, como sempre foi; a automação é só
  pra CONCEDER, nunca pra tirar (menor superfície de erro: um flag a mais
  concedido incorretamente é inofensivo, um flag a menos revogado
  incorretamente pode quebrar uma campanha ativa do usuário sem aviso).
  Defaults semeados pros 3 planos: Starter libera os 3 canais de busca
  (WhatsApp, Instagram, LinkedIn); Pro soma enriquecimento (IA +
  BigDataCorp) e disparo por e-mail; Business soma disparo por LinkedIn
  (o canal mais caro/arriscado, ver `AGENTS.md`/plano de disparo LinkedIn) —
  tudo reconfigurável livremente pelo admin, é só um ponto de partida.
- **Chaves de API de plataforma administráveis em `/admin`** (migration
  `0019_platform_settings.sql`, `src/lib/platform-settings.ts`): pedido
  explícito pra não depender só de variável de ambiente do Railway (trocar
  uma chave, tipo renovar a do Resend, exigia mexer lá e esperar redeploy).
  Tabela key-value `platform_settings` (só o service role lê/escreve — sem
  policy de select/insert pro client, mesma decisão de `subscription_payments`)
  cobre TODAS as chaves de plataforma que eram puro `process.env.X`: Resend,
  Unipile (DSN/API key/webhook secret), BigDataCorp, Asaas (API key/webhook
  token) e o OAuth do Google Sheets. `configPlataforma(chave, envFallback)`
  prioriza o valor cadastrado em `/admin` e cai pro env var do Railway se
  não houver linha — migração incremental, quem ainda não configurou nada
  no painel continua funcionando exatamente como antes. Cache em memória do
  processo com TTL de 30s (mesmo padrão de `custoAcao` em `credits.ts`),
  invalidado explicitamente a cada PATCH no admin. Ficam de fora DE
  PROPÓSITO: a chave OpenAI do Enriquecimento por IA (é BYOK por usuário,
  nunca da plataforma) e as chaves com pool por usuário que já tinham seu
  próprio mecanismo administrável antes disso (Google Maps/Apify/Casa dos
  Dados — `profiles.*_api_key_admin`/`*_keys_pool`). Efeito colateral do
  refactor: todo wrapper de integração (`resend.ts`, `unipile.ts`,
  `bigdatacorp.ts`, `asaas.ts`, `evolution-api.ts`, `google-sheets.ts`)
  teve suas funções de configuração/header convertidas de síncronas pra
  assíncronas (resolvem a chave via Supabase agora, não só `process.env`
  direto) — todo call site foi atualizado a `await` a chamada.
- **Check-up geral do sistema de automações** (fluxos + disparo): auditoria
  pedida explicitamente, cobrindo registro de nós, lógica de retry,
  débito de créditos, re-checagem de flags em tempo de execução,
  compatibilidade de formato de lote entre nós, wiring dos ticks do worker
  e checagem de posse (IDOR) nos nós mais recentes. Achados corrigidos:
  - **[Crítico] `destino_funil` sem checagem de posse**: o executor
    chamava `adicionarLeadsAoFunil` direto com o `funilId`/`colunaId` do
    config do nó, sem confirmar que pertencem ao dono do fluxo — como a
    execução de fluxo roda no cliente admin (ignora RLS), um fluxo
    configurado com o id de outro usuário depositaria leads no Kanban
    alheio silenciosamente. Corrigido chamando `funilPertenceAoUsuario`/
    `colunaPertenceAoFunil` antes, mesma checagem que a rota de API
    `/api/funis/[id]/cards` já fazia.
  - **[Crítico] `fonte_historico` vazava pesquisas de outros usuários**:
    `buscarLeadsDaPesquisa` filtra só por `search_id`, contando com RLS —
    que não vale nada no cliente admin que a execução de fluxo usa. Um
    `searchId` de outro usuário no config do nó retornava o lote de leads
    daquela pesquisa alheia. Corrigido validando `searches.user_id` antes
    de buscar os leads.
  - **[Médio] Nó `enriquecimento_maps` não debitava créditos**: mesmo
    enriquecimento via Google Maps que `extracao_cnpj` já cobra
    (`cnpj_maps_extra`), mas o nó de fluxo genérico esquecia de chamar
    `debitarCreditos` — rodava de graça contra o pool de chaves
    administrado da plataforma. Corrigido espelhando a cobrança de
    `extracao-cnpj.ts`.
  - **[Médio] Nós de disparo (WhatsApp/e-mail/LinkedIn) não
    re-confirmavam o flag do usuário em tempo de execução**: um fluxo
    criado enquanto o flag estava ligado continuava inscrevendo E enviando
    normalmente mesmo depois de um admin revogar
    `disparo_habilitado`/`email_disparo_habilitado`/
    `linkedin_disparo_habilitado` — só a criação/edição de campanha
    passava pela checagem. Corrigido em duas camadas: nos 3 executores de
    fluxo (na inscrição) e nos 3 ticks do worker que efetivamente enviam
    (`dispatch-tick.ts`, `email-dispatch-tick.ts`,
    `linkedin-dispatch-tick.ts`) — defesa em profundidade, já que alvos
    inscritos ANTES da revogação também precisam parar.

  Sem problema encontrado: registro de tipo de nó (`node-types.ts` ↔
  `executors/index.ts` ↔ visuais do canvas seguem em sincronia), orçamento
  de retry da migration 0016 (não corre risco de loop infinito), débito de
  créditos nas 4 extrações avulsas + BigDataCorp, formato de lote entre nós
  encadeados (extração → enriquecimento → disparo/funil), e wiring de todo
  tick do worker em `worker/index.ts`.

  **Follow-up da rodada anterior, agora corrigido** (migration
  `0021_enrichment_runs_requeue.sql`): uma run de fluxo em
  `aguardando_subprocesso` (esperando um `enrichment_runs`/
  `bigdatacorp_enrichment_runs` terminar) não tinha timeout — se o worker
  reiniciasse com a linha em `processando`, ela ficava travada pra sempre,
  fora do orçamento de retry da 0016. Nova coluna `processando_desde`
  nas duas tabelas, gravada no momento da reserva atômica
  (`pendente` → `processando`), lida por um `requeueTravados`-equivalente
  chamado no início dos dois ticks de enriquecimento (`worker/enrichment-tick.ts`,
  `worker/bigdatacorp-enrichment-tick.ts`) — mesmo padrão que
  `dispatch-db.ts::requeueTravados()` já usa pros alvos de disparo, limite
  de 10 minutos.
- **Bug real de billing: `maps_credits_enabled`/`instagram_credits_enabled`/
  `linkedin_credits_enabled` nasciam `false`** (migration
  `0022_credits_enabled_default_true.sql`, achado pelo usuário revisando o
  admin): essas 3 colunas datam de antes da unificação do pool de créditos
  (0013) e nunca tiveram o default atualizado depois. Efeito em produção:
  toda busca avulsa Maps/Instagram/LinkedIn só debita créditos
  `if (profile.<canal>_credits_enabled)` — com o default em `false`, a
  busca RODA (cai no fallback de chave administrada) mas nunca cobra
  créditos; a plataforma paga a Apify, o usuário não paga nada. De quebra,
  o indicador de custo em `/busca/maps` some (`CreditoEstimado` recebe 0) e
  as telas de Configurações mostram os campos de "configure sua própria
  chave" pra todo usuário novo, mesmo sem essa ser a intenção (o Maps já
  escondia esses campos quando o flag estava true; o Apify nunca teve essa
  checagem — corrigido separadamente, ver abaixo). Corrigido: default das
  3 colunas para `true` + backfill de quem ainda estava em `false` (exceto
  conta_teste, que usa outro mecanismo). `ApifySettings.tsx` também ganhou
  a mesma mensagem "opcional, gerenciado pela plataforma por padrão" que o
  Maps já tinha, com os campos de chave própria colapsados atrás de um
  `<details>` em vez de abertos por padrão. Admin ganhou o toggle
  `instagram_credits_enabled` em `AdminUsersTable` (existia na API/schema
  mas não tinha controle na UI — só Maps e LinkedIn tinham).
- **Datafy (canal oficial WhatsApp) — URL base movida pro admin**: a
  URL base do provedor (`datafy_api_base_url`) entrou em `/admin` junto
  das outras chaves de plataforma. As credenciais REAIS de cada número
  oficial (token, phone_number_id, waba_id) continuam por design fora
  dali — são por instância, não por plataforma, provisionadas
  manualmente pelo admin em `/admin/disparo` por conexão (mesmo padrão
  documentado em `.env.example`), então não fazem sentido num campo
  único de "chave de API".
- **Tabela de preços final** (migration `0023_pricing_table_final.sql`),
  alinhada com o usuário, substituindo os valores de placeholder dos
  planos (0018) e pacotes avulsos (0017):
  - **Planos**: Starter R$127/mês · 6.000 créditos, Pro R$347/mês · 30.000
    créditos, Business R$897/mês · 100.000 créditos. Os três liberam os
    mesmos recursos "base" (busca CNPJ/Maps/Instagram/LinkedIn,
    BigDataCorp, Enriquecimento via IA — BYOK, WhatsApp via Evolution sem
    cota, e-mail via Resend). Só o disparo por LinkedIn (Unipile) é
    exclusivo do Business — Starter/Pro tratam como add-on à parte
    (R$150-200/mês, cobrado manualmente pelo admin, que já pode conceder
    o flag pra um usuário específico em `AdminUsersTable` sem esperar um
    mecanismo de cobrança de add-on — isso ainda não existe como fluxo
    self-service, fica pra quando o checkout de add-ons for construído).
    O canal oficial de WhatsApp (Datafy) já é 100% aprovação manual do
    admin (`/disparo/solicitar-oficial`) independente do plano — "add-on
    só no Starter" nesse caso é uma decisão na hora de aprovar a
    solicitação, não precisa de coluna nova.
  - **Pacotes avulsos**: P (2.000 créditos, R$47 — R$0,0235/crédito), M
    (10.000, R$197 — R$0,0197/crédito), G (50.000, R$797 —
    R$0,0159/crédito) — preço por crédito deliberadamente um pouco acima
    do que já vem incluso no plano (incentivo a migrar de plano em vez de
    só comprar avulso, sem ser punitivo), com desconto por volume no
    pacote maior.
  - **Atualização**: os dois itens que este bullet listava como "fora de
    escopo" foram resolvidos nos dois bullets seguintes — cota de e-mail
    por plano e checkout self-service de add-ons.
- **Cota de e-mail por plano** (migration `0024_plan_email_quota.sql`):
  `plans.email_limite_diario` (Starter 100/dia, Pro 300/dia, Business
  1000/dia — mesma unidade diária que `email_senders.limite_diario_envios`
  já suportava, sem inventar um contador mensal agregado novo). Usado como
  valor padrão de qualquer remetente novo que o usuário criar (rota
  `POST /api/email-dispatch/senders`) — o usuário continua podendo editar
  por remetente depois, como já era. Editável em `/admin` (popover
  "Recursos" de `PlansPanel`, junto dos feature flags).
- **Add-ons pagos por assinatura recorrente própria** (migration
  `0025_addon_subscriptions.sql`), pedido explícito: em vez de só
  liberar disparo por LinkedIn nos planos mais caros, qualquer usuário
  pode assinar esse recurso separadamente, como uma segunda assinatura
  Asaas independente do plano. Como `profiles` só tem colunas SINGULARES
  pra assinatura (`plano_id`/`asaas_subscription_id`/`assinatura_status`
  — não cabe um usuário com plano + add-on ativos ao mesmo tempo), a
  solução é uma tabela nova em vez de reaproveitar essas colunas:
  `addons` (catálogo, mirror mínimo de `plans` — nome, preço,
  `feature_flag` que concede) + `user_addon_subscriptions` (1 linha por
  `(usuário, add-on)`, com seu próprio `asaas_subscription_id`/status —
  equivalente em linhas do que as 3 colunas singulares fazem pro plano) +
  `addon_payments` (mirror de `subscription_payments`, alimentada pelo
  webhook). O webhook do Asaas (`/api/webhooks/asaas`) agora tenta
  `processarPagamentoAssinatura` primeiro (plano) e só se não bater
  tenta `processarPagamentoAddon` — mesmo `payment.subscription` do
  Asaas serve pros dois casos, só muda em qual tabela o
  `asaas_subscription_id` é procurado. v1 cobre só o add-on de disparo
  por LinkedIn (único "extra" da tabela de preços com um flag binário
  dedicado e sem dependência de provisionamento manual) — o canal
  oficial de WhatsApp continua de fora de propósito, já que depende de
  aprovação manual do admin de qualquer forma (`/disparo/solicitar-oficial`),
  então cobrar por ele nesta v1 é uma decisão na hora de aprovar a
  solicitação, não um checkout. UI em `/creditos` → aba "Extras" (só
  aparece se houver algum add-on ativo) + CRUD em `/admin`
  (`AddonsPanel`, mesmo padrão de `PlansPanel`).
- **Plano anual (opção A, decidida pelo usuário)**: assinatura Asaas de
  verdade com `cycle: YEARLY` — 1 cobrança por ano, não 12 cobranças
  mensais de um valor menor nem um parcelamento manual. `plans.preco_anual_centavos`
  é um preço independente (seedado como preço mensal × 10, "paga 10 meses,
  leva 12", ~16,7% off), não uma fórmula — o admin ajusta o desconto por
  plano em `/admin` sem depender de recalcular nada. `profiles.assinatura_ciclo`
  guarda qual ciclo aquela assinatura é, porque o Asaas só dispara um
  evento de pagamento por ANO nesse ciclo — `processarPagamentoAssinatura`
  (`subscriptions-db.ts`) usa esse campo pra decidir quanto creditar de
  uma vez: no plano anual, credita os 12 meses (`creditos_mensais * 12`)
  de uma vez só, na confirmação, em vez de tentar represar 1/12 por mês
  sem ter um calendário próprio pra isso (mais simples que construir um
  mecanismo de liberação gradual à parte do calendário de cobrança do
  Asaas, e é o padrão comum de "assinatura anual" em outros produtos —
  acesso ao ano todo já no ato). `monthly_creditos` continua guardando a
  TAXA mensal equivalente (não o lote credido de uma vez), só pra manter
  o card "Renovação mensal" do dashboard com o mesmo significado nos dois
  ciclos. UI: toggle Mensal/Anual em `/creditos` → aba "Planos", mostrando
  o preço equivalente por mês no ciclo anual.
- **Auditoria da lógica de pagamento (avulso + plano + add-on + webhook)**:
  revisão pedida explicitamente depois do plano anual, achou e corrigiu 4
  problemas reais:
  1. *Assinatura órfã ao reassinar inadimplente*: `/api/assinatura` e
     `/api/addons/[addonId]` só bloqueavam reassinar com status `ativa`/
     `pendente`, não `inadimplente` — como `assinarPlano`/`assinarAddon`
     sobrescrevem `asaas_subscription_id` (addon via upsert em
     `user_id,addon_id`), a assinatura antiga (com cobrança vencida, mas
     ainda ativa no Asaas) nunca era cancelada: continuava cobrando o
     cliente e, uma vez órfã do nosso banco, nenhum webhook futuro dela
     batia com nada (créditos_purchases/subscription/addon), então
     desaparecia. Os dois endpoints agora bloqueiam `inadimplente`
     também — a UI já tinha o botão "Cancelar" pra esse status.
  2. *DELETE de plano/add-on com assinantes ativos*: hard-delete direto
     na tabela, sem checar assinantes. `profiles.plano_id` é ON DELETE
     SET NULL (renovação seguinte credita 0, cliente continua sendo
     cobrado) e `user_addon_subscriptions.addon_id` é ON DELETE CASCADE
     (a linha do assinante some inteira, sem cancelar a cobrança nem
     deixar rastro pra ele cancelar). Ambos os endpoints DELETE agora
     recusam (409) se houver assinante `ativa`/`pendente`/`inadimplente`
     — o toggle "Ativo" já existente é o jeito certo de tirar da vitrine.
  3. *Crédito não-atômico com a marca de "processado"*: `marcarCompraPaga`
     e `processarPagamentoAssinatura` faziam o UPDATE/INSERT que garante
     idempotência (contra reentrega do webhook) e o `increment_creditos`
     como duas chamadas separadas — um erro transitório entre as duas
     deixava o pagamento marcado como processado pra sempre sem o
     crédito nunca ter chegado, e a guarda de idempotência impedia
     qualquer reenvio futuro de corrigir isso. Fix:
     `marcar_compra_paga_e_creditar`/`registrar_pagamento_assinatura_e_creditar`
     (0027_atomic_payment_credit.sql) fazem as duas escritas na mesma
     função plpgsql (uma transação).
  4. *Webhook sempre respondia 200 OK*: mesmo quando uma das funções
     acima falhava de verdade (não "evento repetido", um erro genuíno),
     a rota respondia `{ ok: true }` incondicionalmente — o Asaas nunca
     reentregava, e a falha não aparecia em log nenhum. Agora a rota
     captura exceções e responde 500 (as funções chamadas já são
     idempotentes, reentrega é segura), com `console.error` de quem
     falhou e o id do evento. `cancelarAssinatura` também passou a
     tratar 404 do Asaas (assinatura já removida por lá) como sucesso,
     em vez de deixar o usuário travado sem conseguir cancelar localmente.

- **Limpeza geral + segurança (Fase 0 do onboarding com presets)**:
  - *Chaves só da plataforma*: Casa dos Dados, Google Maps e Apify saíram
    do perfil do usuário (chave própria, "administrada" e pools com
    rodízio). Resolução única em `src/lib/platform-keys.ts`: valor do
    `/admin` → Chaves da plataforma, com a env var como fallback. A página
    Configurações virou **Conexões** (`/conexoes`): status real de
    WhatsApp, e-mail, LinkedIn, Google Sheets e OpenAI (`src/lib/conexoes.ts`,
    calculado das tabelas, nunca de marcação manual) — é a mesma fonte que
    o passo a passo do onboarding vai usar. A única chave que o usuário
    traz é a da OpenAI.
  - *Toda ação debita crédito*: os flags `*_credits_enabled` (Maps,
    Instagram, LinkedIn) permitiam uma busca de graça se alguém os
    desligasse; saíram. A busca CNPJ e o nó de fluxo equivalente passaram a
    pré-checar o saldo somando a verificação no Maps (55 créditos/lead —
    antes só o CNPJ era checado e o débito satura em zero, então saldo
    pequeno liberava centenas de chamadas pagas ao Google). O nó de
    extração Maps e o de enriquecimento Maps ganharam a pré-checagem que
    não tinham.
  - *Escalonamento de privilégio fechado* (`0028_seguranca_profiles.sql`):
    a policy de update em `profiles` não restringia colunas e a chave anon
    é pública — qualquer usuário logado podia se tornar admin ou se dar
    créditos via REST. Trigger agora só deixa o próprio usuário mudar
    `openai_api_key`/`google_sheets_creds`; campos de assinatura/Asaas
    passaram a ser gravados com o cliente admin. Funções que creditam
    saldo não são mais executáveis por `authenticated`, e
    `decrement_creditos` só debita a própria conta. A view `user_stats`
    (e-mail, papel e saldo de todos) também era legível por qualquer
    usuário — agora só o servidor lê.
  - *`platform_settings` nunca funcionou*: 0002 já criava uma tabela com
    esse nome (linha única), então a chave/valor de 0019 não era criada e
    o painel de chaves do admin não gravava nada. `0029_limpeza_legado.sql`
    substitui a tabela e copia pra ela as chaves que existiam por usuário.
  - *Conta de teste*: recebe a quantidade global de créditos
    (`creditos_conta_teste`, em Chaves da plataforma; padrão 1000) e acesso
    a tudo, menos disparo por LinkedIn e canal oficial de WhatsApp; não
    compra créditos, planos nem extras (`src/lib/conta-teste.ts`).
  - *Removidos*: automações antigas (busca agendada — substituídas pelos
    fluxos), painel de disparo automático do admin, galeria de templates de
    fluxo (vai ser substituída pelos presets gerados no onboarding). Admin
    reorganizado em abas: Usuários · Planos e preços · Chaves da plataforma.

- **Onboarding com presets gerados por IA** (`/onboarding`,
  `src/lib/onboarding/`):
  - *Questionário* (`questionario.ts`): 7 etapas — empresa e oferta,
    cliente ideal, decisor, canais, volume e tolerância a risco, base
    própria, tom das mensagens. Perguntas condicionais, salvamento
    automático e checagem de pendências antes de gerar.
  - *Catálogo fechado de cenários* (`cenarios.ts`): 17 caminhos mapeados
    por tipo de lead e canal (CNPJ → WhatsApp/e-mail/multicanal, com ou sem
    sócio validado; recém-abertas; recuperação judicial; Maps com e sem
    IA; LinkedIn por conexão, e-mail ou ABM com IA; audiência de
    Instagram; reativação e enriquecimento de base própria; lista pro time
    comercial). A IA **não inventa fluxo**: escolhe o cenário, preenche os
    parâmetros e escreve as mensagens. O servidor normaliza os parâmetros e
    monta o grafo com os mesmos schemas dos nós do construtor — então todo
    preset é um fluxo válido e com custo calculável.
  - *Custo e volume são do servidor, não da IA* (`estimativa.ts`): custo
    por lead pelas ações de crédito do cenário, capacidade do canal
    (WhatsApp 40/80/150 por dia conforme a tolerância, LinkedIn 15–25,
    e-mail pelo limite do plano) e orçamento = créditos do plano assinado
    (ou o saldo, sem plano). Cada plano sozinho cabe em até 80% do
    orçamento; se passar, o volume é reduzido e o ajuste aparece pro
    cliente.
  - *Gerador + avaliador* (`ia.ts`, `prompt.ts`): uma IA monta os planos
    A–D (alternativas de verdade: fonte, canal ou investimento diferentes,
    com as regras de custo-benefício — ex.: sócio validado só compensa em
    ticket médio/alto; negócio local começa pelo Maps, ~10x mais barato
    que CNPJ + verificação no Maps). Uma segunda IA julga cada plano
    (nota, veredito, pontos de atenção) e, se algum sai "arriscado" ou
    "inviável", o gerador faz uma rodada de revisão com os ajustes. Sem
    revisão humana. Structured output (Responses API + zod) garante o
    formato. Roda no worker (`worker/onboarding-tick.ts`) com lease e
    heartbeat, até 3 tentativas. Chave: `openai_api_key_plataforma` (Chaves
    da plataforma) ou `OPENAI_API_KEY`; modelo: `onboarding_modelo_ia` ou
    `ONBOARDING_MODELO_IA` (padrão `gpt-5.6-luna`). Os textos pro cliente não
    citam fornecedores.
  - *Usar o plano → passo a passo → play* (`aplicar.ts`): "Usar este plano"
    cria funil, campanhas (rascunho, com a cadência escrita pela IA) e o
    fluxo desligado. O checklist é calculado do estado real
    (`statusConexoes`, planilha da base, mensagens, créditos), nunca de
    marcação manual. O play liga campanhas e fluxo usando o primeiro
    recurso conectado de cada canal (WhatsApp só instância não oficial).
  - *Guia flutuante* (`guia-flutuante.tsx`): enquanto houver plano em
    configuração, um cartão no canto mostra o próximo passo, leva à tela
    certa e destaca o ponto exato (`data-guia="<id do passo>"`). Reserva
    espaço no rodapé da página pra não cobrir botões e começa recolhido no
    celular. A visão geral mostra a chamada pro onboarding até existir um
    plano rodando.

- **Construtor de fluxos — usabilidade e rascunho**:
  - *Rascunho*: antes, salvar exigia o fluxo 100% configurado — não dava
    pra guardar um fluxo pela metade. Agora a validação é em dois níveis
    (`validarEstruturaFluxo` sempre; `validarFluxo` completo só pra ativar
    ou executar). Com pendências, o editor salva como rascunho pausado. O
    PATCH valida o estado resultante (antes, `{ativo: true}` sozinho ligava
    um fluxo sem revalidar) e o "Executar agora" recusa fluxo incompleto.
  - *Nó de disparo sem campanha* passou a ser pendência (o executor já
    falhava na hora de rodar; agora barra antes de ativar).
  - *Editor*: tela cheia (Esc sai), tema do canvas segue o do app (era
    fixo no escuro), clique no módulo adiciona já conectado depois do nó
    selecionado (ou no fim do caminho) — arrastar continua valendo e é o
    único jeito que não funciona no celular —, busca na paleta, "Organizar"
    alinha o caminho, remover um nó religa o anterior ao seguinte, gatilho
    não some com Delete por engano. Cada cartão mostra o resumo da config
    (`src/lib/flow/resumo.ts`), o problema pendente e o resultado da última
    execução. Lista de pendências (gatilho, config, nó solto que nunca
    roda) com clique que leva ao nó. Aviso de alterações não salvas
    (inclusive ao fechar a aba), Ctrl/Cmd+S salva, histórico se atualiza
    sozinho enquanto há execução em andamento.
  - *Correções de HTML/hidratação*: botão "Tentar novamente" ficava dentro
    do botão que abre o item do histórico (HTML inválido, erro de
    hidratação) — `Collapsible` ganhou `acoes`; `<html>` com
    `suppressHydrationWarning` porque o script anti-FOUC muda `data-theme`
    antes da hidratação.

- **Sugestões, metodologia comercial e funil automático**:
  - *Sugestão, não plano*: os caminhos gerados pelo onboarding se chamam
    "Sugestão A–D" (plano, pro cliente, é a assinatura). Modelo padrão
    `gpt-5.6-luna` (tier mais barato da família 5.6, com structured outputs;
    trocável em Chaves da plataforma).
  - *Metodologia* (`prompt.ts`, mesma régua pro gerador e pra avaliadora):
    público em três camadas (firmográfico, momento/gatilho, pessoa), oferta
    de entrada de baixo atrito, canal pelo perfil do decisor no Brasil,
    cadência curta com ângulo novo a cada toque, LGPD e métrica honesta.
    Parâmetros novos: idade mínima da empresa e capital máximo. Pergunta
    nova no questionário: quem assina as mensagens.
  - *Copy sem cara de IA* (`copy.ts`): revisor determinístico que acusa
    expressões robóticas ("espero que esteja bem", "solução inovadora",
    "só passando pra saber"…), travessão, mais de 1 emoji/exclamação,
    CAIXA ALTA, lista com marcadores, link no 1º WhatsApp, mais de uma
    pergunta, tamanho por canal e variável inexistente. Travessão e atraso
    fora de múltiplos de 24h são consertados na hora; o resto vai pra
    avaliadora e força uma rodada de revisão. O que sobrar aparece pro
    cliente em "vale ajustar no texto".
  - *Funil automático* (`funil-automacao.ts`, `contatos.ts`): cada sugestão
    cria o funil com "Novos leads → Em cadência → Respondeu" (papéis
    automáticos) + etapas do negócio escritas pela IA. A primeira mensagem
    move o card pra "Em cadência". Resposta no WhatsApp (webhook
    MESSAGES_UPSERT da Evolution, registrado quando o número conecta) ou no
    LinkedIn (webhook "messaging" da Unipile) para a cadência daquele
    contato em TODOS os canais e move o card pra "Respondeu" — antes, quem
    respondia continuava recebendo follow-up. E-mail não tem detecção
    automática: arrastar o card pra frente faz o mesmo. Casamento por
    chave normalizada (telefone por DDD + 8 últimos dígitos, porque o
    WhatsApp às vezes omite o 9º dígito).
  - *Volume, custo e resultado* (`estimativa.ts`): o volume sai da meta do
    cliente (faixa marcada, conta de trás pra frente das reuniões,
    capacidade do time), não do saldo; cada sugestão mostra o volume
    sugerido, o que cabe nos créditos de hoje (o cliente escolhe com qual
    começar), o plano que comporta (no máximo um acima do atual) e a faixa
    de reuniões/mês com o custo por reunião. A capacidade do WhatsApp conta
    os follow-ups (~4,5 mensagens por lead), então um número aborda ~600
    leads novos/mês no perfil equilibrado. Cadências: WhatsApp 5 toques em
    ~2 semanas, e-mail 6 em ~4, LinkedIn nota + 4; cada sugestão traz
    respostas prontas pra quando o lead responde. A IA monta um portfólio
    (volume x qualificada) e escolhe a fonte por critérios, sem viés fixo
    pra CNPJ ou Maps.
  - *Gerar de novo sem travar*: cada uso de sugestão guarda cópia da
    sugestão e a geração de origem — a nova "Sugestão A" pode ser usada
    mesmo que a A antiga já esteja rodando.
  - *Meu perfil* (`/perfil`): todas as respostas editáveis, com
    "Atualizar sugestões". *Buscas avulsas*: toggle "Sugestões pro seu
    público" com públicos que a IA gera junto com as sugestões e que
    preenchem o formulário com um clique.
  - *Correção*: o proxy redirecionava pro /login o link de descadastro do
    rodapé dos e-mails e os webhooks do LinkedIn (rotas públicas fora de
    /api/webhooks) — nenhum dos dois funcionava.

- **Página de vendas** (`/conheca`, pública): rota fora do app, com paleta
  própria sempre escura (tokens `lp-*` em `globals.css`, efeitos em
  `src/app/conheca/lp.css`) e fontes que só carregam ali
  (`src/app/conheca/fontes.ts`). Componentes em `src/components/lp/`: hero
  com o fluxo de leads animado, manifesto que acende palavra por palavra na
  rolagem, a história em seis etapas (palco fixo no desktop, cena embaixo de
  cada texto no celular), semana com/sem, simulação, recursos, planos,
  perguntas frequentes e chamada final. Também tem a seção sobre não depender
  de tráfego pago (`sem-trafego.tsx`), o enriquecimento com IA e decisor
  animado (`enriquecimento.tsx`, com o que o enriquecimento entrega de fato:
  quadro societário, contato do decisor, validação no Maps, pesquisa com IA e
  perguntas personalizadas), o comparativo por tipo de solução
  (`comparativo.tsx`: tráfego pago, SDR, base de dados, ferramentas
  internacionais, sem números de concorrentes) e a vitrine de clientes do
  Revolução AI (`clientes.tsx`, imagens em `public/lp/clientes`, as mesmas do
  site). As cenas são telas simuladas do
  produto (dados fictícios, marcados como simulação). A simulação usa as
  mesmas faixas de resposta da estimativa do onboarding (`estimativa.ts`) e
  indica o menor plano cujos créditos cobrem o volume (custo por empresa =
  `cnpj` + `cnpj_maps_extra` de `credit_costs`). Na seção de planos, o plano
  do meio fica em destaque como "Recomendado"; o indicado pela simulação
  ganha um selo próprio. Planos e custos vêm do banco
  (`src/lib/planos-publicos.ts`), com revalidação a cada 10 min; sem banco, a
  página mostra o contato no lugar dos preços. Respeita
  `prefers-reduced-motion`. A regra global de cor de borda (fora de camada,
  ganha das classes `border-*`) não se aplica dentro de `.lp`.

- **Contratação automática** (`/assinar` → `/bem-vindo` → `/onboarding`):
  os botões de plano levam para `/assinar?plano=<id>&ciclo=anual|mensal`
  (pública). O formulário pede nome, empresa, e-mail, WhatsApp, CPF/CNPJ
  (dígitos verificadores conferidos em `cpf-cnpj.ts`) e senha.
  `POST /api/assinar` cria o usuário pelo cliente admin (e-mail já
  confirmado), grava os dados no perfil, abre a assinatura no Asaas com
  `assinarPlano` e faz o login na mesma resposta. Se o Asaas falhar antes de
  criar a assinatura, a conta é apagada para a pessoa tentar de novo; se a
  assinatura existir e só a fatura atrasar, segue normalmente. Proteções:
  limite de 6 tentativas por IP a cada 15 min (em memória, por instância —
  `limite-tentativas.ts`) e campo invisível contra robôs. `/bem-vindo`
  mostra a fatura e consulta `/api/assinatura` a cada 5 s; quando o
  webhook do Asaas ativa a assinatura (créditos + recursos do plano, como já
  acontecia), libera o botão do onboarding. Quem fecha a página antes de
  pagar vê um aviso de pagamento pendente no painel. O cadastro aberto do
  Supabase continua podendo ficar desligado: a conta é criada pelo servidor.
  O WhatsApp (`NEXT_PUBLIC_LP_WHATSAPP`) fica para "Falar com um
  especialista".

- **Dados do cliente** (`0033`): nome, telefone (guardado em E.164) e
  empresa no perfil. O admin preenche ao criar a conta (nome obrigatório) e
  edita em *Conta do usuário*; a tabela de usuários mostra nome, e-mail,
  empresa e telefone. O cliente corrige em *Meu perfil → Seus dados*
  (`PATCH /api/perfil`, com a sessão dele — o trigger de `0028` libera só
  essas três colunas). O questionário de prospecção já vem com nome da
  empresa e quem assina preenchidos, e o cliente do Asaas é criado com o
  nome (CPF) ou a empresa (CNPJ) e o celular. *Correção*: `handle_new_user`
  lia o papel do `user_metadata`, que quem se cadastra controla — com o
  cadastro aberto no Supabase, dava pra criar conta já como admin.

- **Ritmo de envio, teste A/B e status de entrega/leitura** (`0032`):
  - *Ritmo* (`ritmo.ts`, card "Ritmo de envio" em cada campanha): limite
    de leads NOVOS por dia (o 1º toque; follow-up de quem já está na
    cadência não conta), janela de horário e dias da semana no fuso de São
    Paulo e intervalo entre envios. As regras ficam dentro das funções de
    claim no banco — o worker simplesmente não recebe alvo fora da janela
    ou além do limite, então nenhum caminho de envio escapa. Dá pra jogar
    500 leads numa campanha e ela "pinga" 30 por dia. Campanhas criadas
    pelas sugestões já nascem com 30 (WhatsApp), 40 (e-mail) e 15
    (LinkedIn) por dia, dias úteis das 8h às 19h. Os limites diários por
    número/remetente/conta passaram a virar o dia à meia-noite de Brasília
    (antes viravam às 21h, no fuso do servidor), e o lote de e-mail não
    passa mais do que cabe no limite diário do remetente.
  - *Nó "Limitar lote"* nos fluxos: deixa seguir no máximo N leads por
    execução (os primeiros, sorteados, ou os melhores por um campo, tipo
    avaliação). É o freio entre uma extração grande e um disparo.
  - *Escrever a cadência inteira* (`cadencia-texto.ts`): um texto só com
    todas as mensagens separadas por `--- 2 dias`, com linha do tempo
    (Dia 0, Dia 2, Dia 5…) e o mesmo revisor de copy das sugestões
    apontando o que soa robótico enquanto se escreve. Editar uma cadência
    existente atualiza as etapas no lugar (quem está no meio segue de onde
    parou); etapa que já foi enviada não pode ser apagada, e a tela agora
    diz isso em vez de fingir que apagou.
  - *Teste A/B*: cada etapa pode ter uma versão B (texto; no e-mail
    também o assunto; no LinkedIn a nota do convite). O alvo sorteia A ou
    B ao entrar e recebe sempre a mesma; o log guarda a versão que de fato
    saiu (etapa sem B conta como A). As sugestões da IA já vêm com uma
    versão B do 1º toque. O relatório compara resposta (e aceite, no
    LinkedIn) com um teste de duas proporções e só declara vencedor com
    ~30 leads por versão e 80%+ de confiança.
  - *Entregue/lido*: WhatsApp não-oficial pelo evento MESSAGES_UPDATE da
    Evolution (as instâncias re-registram o webhook sozinhas depois da
    0032); canal oficial por `/api/webhooks/whatsapp-oficial` (formato da
    Cloud API da Meta, que a Datafy espelha — URL e token de verificação
    em /admin/disparo); LinkedIn pelos eventos `message_read` /
    `message_delivered` do webhook "messaging" da Unipile; e-mail por
    `/api/webhooks/resend` (assinatura Svix), com devolução permanente e
    marcação de spam indo direto pro descadastro. Resposta "sair",
    "parar", "não quero receber" no WhatsApp também descadastra o número.
    Quem desliga a confirmação de leitura no WhatsApp nunca aparece como
    lido, e abertura de e-mail é aproximada — por isso o relatório põe a
    resposta em destaque, não a leitura.

- **Teste grátis e garantia** (`/teste-gratis`, `src/lib/teste-gratis*.ts`,
  `0034_teste_gratis.sql`):
  - *Cadastro público sem cartão*: nome, empresa, e-mail, WhatsApp e
    senha. A conta nasce com `teste_gratis = true`, nenhum recurso de plano
    e os créditos de `creditos_teste_gratis` (Chaves da plataforma, padrão
    100, para extrair por CNPJ e Maps; com 0, o teste serve só para
    conhecer a plataforma). Os textos do cadastro, do painel e das
    telas bloqueadas mudam conforme haja créditos ou não, e a busca sem
    saldo no teste explica que a extração é liberada ao assinar. Um teste por e-mail e por WhatsApp, 3 cadastros por hora
    por IP e campo invisível contra robôs.
  - *O que libera*: busca por CNPJ e Google Maps, histórico, perfil e
    créditos. O resto aparece no menu com cadeado e abre em *modo de
    visualização* (`PortaoTesteGratis`): a página real, com uma faixa no
    topo; dá para navegar, trocar de aba e abrir formulários, mas qualquer
    ação (chamada não-GET à API, ou o login com o Google) é barrada no
    navegador antes de sair e abre o convite para assinar. O servidor
    recusa por conta própria: disparos, enriquecimento e Instagram/LinkedIn
    caem pelas flags do perfil (desligadas); fluxos, funil, onboarding e
    integrações aceitam só leitura no teste, checado no proxy, que só
    consulta o perfil nessas chamadas. Exceção: a estratégia por IA
    (`/onboarding`) não abre nem em visualização; mostra só o convite
    para assinar. As buscas de Instagram e LinkedIn não mostram o custo em
    créditos no teste. Créditos avulsos e extras ficam fora: no teste só o
    plano faz sentido.
  - *Fim do teste*: o webhook de pagamento desliga `teste_gratis` na 1ª
    cobrança confirmada (e `emTesteGratis` já ignora a coluna com a
    assinatura ativa). A coluna é protegida pelo trigger de 0028, então o
    próprio usuário não consegue se liberar.
  - *Diferente de `conta_teste`*: aquela é a conta de demonstração criada
    pelo admin, com quase tudo liberado.
  - *Garantia de 7 dias* na página de planos, no checkout e no FAQ — é o
    direito de arrependimento do CDC (art. 49) para compras online, então
    não cria obrigação nova; o reembolso é feito manualmente no Asaas.

## Estrutura

```
src/
  app/
    login/                    página de login
    (app)/                    área autenticada (proxy.ts redireciona sem sessão)
      busca/cnpj|maps|instagram|linkedin/  as quatro buscas
      historico/                lista + detalhe de pesquisas
      funil/                     Kanban de pipeline (funil/[id] = board)
      automacoes/                construtor de fluxos (fluxos/novo, fluxos/[id])
      disparo/                   instâncias, campanhas, cadência, solicitação de canal oficial
      conexoes/                  status das conexões (WhatsApp, e-mail, LinkedIn, Sheets, OpenAI)
      onboarding/                questionário → sugestões A–D geradas por IA → passo a passo e play
      perfil/                    perfil de prospecção editável + atualizar sugestões
      admin/                      usuários, planos e preços, chaves da plataforma, canal oficial
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
    funil-db.ts                CRUD do Funil (Kanban)
    flow/                      construtor de fluxos: node-types, flow-engine, executors/
worker/                        processo de background (automações, disparo, enriquecimento IA, fluxos)
supabase/migrations/           schema SQL (0001 Fase 0 · 0002 plataforma completa · 0003–0007 incrementais)
```
