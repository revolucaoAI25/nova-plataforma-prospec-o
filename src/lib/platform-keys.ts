import { configPlataforma } from "@/lib/platform-settings";

// Chaves de fornecedores de extração — sempre da plataforma (cadastradas em
// /admin → Chaves da plataforma, ou env var no Railway). Usuário final não
// configura nenhuma delas; a única chave que ele traz é a da OpenAI.

export function chaveCasaDosDados(): Promise<string> {
  return configPlataforma("cdd_api_key", process.env.CDD_API_KEY);
}

export function chaveGoogleMaps(): Promise<string> {
  return configPlataforma("google_maps_api_key", process.env.GOOGLE_MAPS_API_KEY);
}

export function chaveApify(): Promise<string> {
  return configPlataforma("apify_api_key", process.env.APIFY_API_KEY);
}
