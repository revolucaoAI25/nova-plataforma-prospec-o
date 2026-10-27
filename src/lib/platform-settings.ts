import { createAdminClient } from "@/lib/supabase/admin";
import type { PlatformSettingKey } from "@/lib/database.types";

// Resolve chaves de API de plataforma administradas em /admin (tabela
// platform_settings), com fallback pra variável de ambiente — permite
// migrar gradualmente sem quebrar quem ainda só tem a env var no Railway
// configurada, e sem exigir que TODO serviço seja recadastrado no painel
// no dia em que isto for pro ar. Mesmo espírito de cache do custoAcao em
// credits.ts: lido em quase todo request de integração, muda raramente.
const cache = new Map<PlatformSettingKey, string | null>();
let carregadoEm = 0;
const CACHE_TTL_MS = 30_000;

async function carregarConfiguracoes(): Promise<Map<PlatformSettingKey, string | null>> {
  const agora = Date.now();
  if (carregadoEm && agora - carregadoEm < CACHE_TTL_MS) return cache;

  const admin = createAdminClient();
  const { data } = await admin.from("platform_settings").select("chave, valor");
  cache.clear();
  for (const row of data ?? []) {
    cache.set(row.chave as PlatformSettingKey, row.valor);
  }
  carregadoEm = agora;
  return cache;
}

/**
 * Valor de uma configuração de plataforma: prioriza o que o admin
 * cadastrou em /admin (tabela platform_settings), cai pra env var do
 * Railway se não houver linha ou o valor estiver vazio.
 */
export async function configPlataforma(
  chave: PlatformSettingKey,
  envFallback?: string,
): Promise<string> {
  const mapa = await carregarConfiguracoes();
  const valorDb = mapa.get(chave);
  return (valorDb && valorDb.trim()) || envFallback || "";
}

/** Chama depois de um PATCH em /api/admin/platform-settings pra não servir valor velho pelos próximos 30s de cache. */
export function invalidarCachePlatformSettings() {
  carregadoEm = 0;
  cache.clear();
}

/** Rótulo e descrição de cada chave, pra a UI de admin — env var de fallback documentada por chave. */
export const PLATFORM_SETTINGS_META: Record<
  PlatformSettingKey,
  { grupo: string; label: string; envFallback: string; secreto: boolean }
> = {
  cdd_api_key: { grupo: "Casa dos Dados (busca CNPJ)", label: "API Key", envFallback: "CDD_API_KEY", secreto: true },
  google_maps_api_key: { grupo: "Google Maps (verificação de CNPJ)", label: "API Key", envFallback: "GOOGLE_MAPS_API_KEY", secreto: true },
  apify_api_key: { grupo: "Apify (Maps, Instagram, LinkedIn)", label: "API Token", envFallback: "APIFY_API_KEY", secreto: true },
  openai_api_key_plataforma: { grupo: "IA do onboarding (OpenAI)", label: "API Key da plataforma", envFallback: "OPENAI_API_KEY", secreto: true },
  onboarding_modelo_ia: { grupo: "IA do onboarding (OpenAI)", label: "Modelo (padrão gpt-5.6-luna)", envFallback: "ONBOARDING_MODELO_IA", secreto: false },
  creditos_conta_teste: { grupo: "Conta de teste", label: "Créditos concedidos a cada nova conta de teste", envFallback: "CREDITOS_CONTA_TESTE", secreto: false },
  creditos_teste_gratis: { grupo: "Teste grátis (cadastro público)", label: "Créditos de cada novo teste grátis (padrão 100)", envFallback: "CREDITOS_TESTE_GRATIS", secreto: false },
  dias_teste_gratis: { grupo: "Teste grátis (cadastro público)", label: "Duração do teste em dias (padrão 7; 0 = sem prazo)", envFallback: "DIAS_TESTE_GRATIS", secreto: false },
  email_remetente_plataforma: { grupo: "E-mails da plataforma", label: "Remetente (recuperação de senha, retomada e avisos; ex.: Leadmatic <contato@seudominio.com.br>; domínio verificado no Resend)", envFallback: "EMAIL_REMETENTE_PLATAFORMA", secreto: false },
  email_alertas_admin: { grupo: "E-mails da plataforma", label: "Quem recebe os avisos do admin (e-mails separados por vírgula; vazio = todos os admins)", envFallback: "EMAIL_ALERTAS_ADMIN", secreto: false },
  meta_pixel_id: { grupo: "Rastreamento (Meta)", label: "ID do Pixel da Meta", envFallback: "META_PIXEL_ID", secreto: false },
  meta_capi_token: { grupo: "Rastreamento (Meta)", label: "Token da API de Conversões da Meta", envFallback: "META_CAPI_TOKEN", secreto: true },
  meta_test_event_code: { grupo: "Rastreamento (Meta)", label: "Código de teste de eventos (só enquanto testa; depois apague)", envFallback: "META_TEST_EVENT_CODE", secreto: false },
  resend_api_key: { grupo: "Resend (e-mail)", label: "API Key", envFallback: "RESEND_API_KEY", secreto: true },
  resend_webhook_secret: { grupo: "Resend (e-mail)", label: "Signing secret do webhook (whsec_…)", envFallback: "RESEND_WEBHOOK_SECRET", secreto: true },
  unipile_dsn: { grupo: "Unipile (LinkedIn)", label: "DSN (URL do tenant)", envFallback: "UNIPILE_DSN", secreto: false },
  unipile_api_key: { grupo: "Unipile (LinkedIn)", label: "API Key", envFallback: "UNIPILE_API_KEY", secreto: true },
  unipile_webhook_secret: { grupo: "Unipile (LinkedIn)", label: "Segredo do webhook", envFallback: "UNIPILE_WEBHOOK_SECRET", secreto: true },
  directd_token: { grupo: "Direct Data (celular do sócio)", label: "Token", envFallback: "DIRECTD_TOKEN", secreto: true },
  asaas_api_key: { grupo: "Asaas (pagamentos)", label: "API Key", envFallback: "ASAAS_API_KEY", secreto: true },
  asaas_webhook_token: { grupo: "Asaas (pagamentos)", label: "Token do webhook", envFallback: "ASAAS_WEBHOOK_TOKEN", secreto: true },
  google_client_id: { grupo: "Google Sheets (OAuth)", label: "Client ID", envFallback: "GOOGLE_CLIENT_ID", secreto: false },
  google_client_secret: { grupo: "Google Sheets (OAuth)", label: "Client Secret", envFallback: "GOOGLE_CLIENT_SECRET", secreto: true },
  // Seletor do Google (Picker): a chave vai para o navegador de quem conecta, então não é segredo; restrinja-a ao domínio da plataforma no Google Cloud.
  google_picker_api_key: { grupo: "Google Sheets (OAuth)", label: "Chave de API do seletor de planilhas (Google Picker API)", envFallback: "GOOGLE_PICKER_API_KEY", secreto: false },
  google_projeto_numero: { grupo: "Google Sheets (OAuth)", label: "Número do projeto no Google Cloud (App ID do seletor)", envFallback: "GOOGLE_PROJETO_NUMERO", secreto: false },
  evolution_api_url: { grupo: "Evolution API (WhatsApp)", label: "URL base", envFallback: "EVOLUTION_API_URL", secreto: false },
  evolution_api_key: { grupo: "Evolution API (WhatsApp)", label: "API Key", envFallback: "EVOLUTION_API_KEY", secreto: true },
  webhook_segredo: { grupo: "Evolution API (WhatsApp)", label: "Segredo do webhook de respostas (opcional)", envFallback: "WEBHOOK_SECRET", secreto: true },
  datafy_api_base_url: { grupo: "Datafy (WhatsApp — canal oficial)", label: "URL base", envFallback: "DATAFY_API_BASE_URL", secreto: false },
  datafy_account_token: { grupo: "Datafy (WhatsApp — canal oficial)", label: "Token de conta de parceiro (sk_acct_…): cria e conecta os canais dos clientes", envFallback: "DATAFY_ACCOUNT_TOKEN", secreto: true },
  whatsapp_oficial_app_secret: { grupo: "Datafy (WhatsApp — canal oficial)", label: "App Secret da Meta (só se o webhook vier direto da Meta)", envFallback: "WHATSAPP_OFICIAL_APP_SECRET", secreto: true },
};
