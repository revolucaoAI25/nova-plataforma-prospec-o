import type { Profile } from "@/lib/database.types";

/**
 * Perfil para componentes de tela (vai no HTML para o navegador): sem os
 * tokens do Google Sheets, sem a chave da OpenAI e sem os dados de origem
 * da conta. Os componentes só precisam saber se a planilha está conectada.
 */
export function perfilParaTela(p: Profile): Profile {
  const creds = p.google_sheets_creds;
  return {
    ...p,
    openai_api_key: null,
    rastreamento: null,
    google_sheets_creds: creds
      ? { ...creds, oauth: creds.oauth ? { token: "", token_uri: creds.oauth.token_uri, scopes: creds.oauth.scopes } : null }
      : null,
  };
}
