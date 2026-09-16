// Wrapper fino para a Evolution API (gateway WhatsApp não-oficial,
// self-hosted). Auth: header `apikey` (chave global da instância do
// servidor). Portado de modules/evolution_api.py.
//
// Configuração necessária: EVOLUTION_API_URL, EVOLUTION_API_KEY.

function baseUrl(): string {
  return (process.env.EVOLUTION_API_URL || "").replace(/\/$/, "");
}

function headers(): Record<string, string> {
  return { apikey: process.env.EVOLUTION_API_KEY || "", "Content-Type": "application/json" };
}

export function evolutionConfigurado(): boolean {
  return Boolean(process.env.EVOLUTION_API_URL && process.env.EVOLUTION_API_KEY);
}

async function req(path: string, init?: RequestInit) {
  const resp = await fetch(`${baseUrl()}${path}`, { ...init, headers: headers() });
  if (!resp.ok) throw new Error(`Evolution API HTTP ${resp.status}: ${(await resp.text()).slice(0, 300)}`);
  return resp.json();
}

export async function criarInstancia(nomeInstancia: string) {
  return req("/instance/create", {
    method: "POST",
    body: JSON.stringify({ instanceName: nomeInstancia, qrcode: true, integration: "WHATSAPP-BAILEYS" }),
  });
}

export async function obterQrcode(nomeInstancia: string) {
  return req(`/instance/connect/${encodeURIComponent(nomeInstancia)}`);
}

/**
 * Retorna (estado, numero) — `connectionState` tem um bug conhecido na
 * Evolution API onde fica preso em "connecting" mesmo já pareado, então
 * também consulta `fetchInstances`, que reflete o estado real mais rápido
 * e traz o número conectado.
 */
export async function statusENumero(nomeInstancia: string): Promise<{ estado: string; numero: string }> {
  let estadoCs = "";
  try {
    const data = await req(`/instance/connectionState/${encodeURIComponent(nomeInstancia)}`);
    estadoCs = data?.instance?.state || "";
  } catch {
    // segue com fetchInstances
  }

  let estadoFi = "";
  let numero = "";
  try {
    const params = new URLSearchParams({ instanceName: nomeInstancia });
    const itens = await req(`/instance/fetchInstances?${params}`);
    const item = Array.isArray(itens) && itens.length ? itens[0] : {};
    const inst = item?.instance ?? item ?? {};
    estadoFi = inst.connectionStatus || inst.state || "";
    numero = inst.number || (inst.ownerJid || "").split("@")[0] || "";
  } catch {
    // segue com o que já tem
  }

  const estado = estadoCs === "open" || estadoFi === "open" ? "open" : estadoCs || estadoFi || "close";
  return { estado, numero };
}

export async function desconectarInstancia(nomeInstancia: string) {
  await fetch(`${baseUrl()}/instance/logout/${encodeURIComponent(nomeInstancia)}`, {
    method: "DELETE",
    headers: headers(),
  });
}

export async function excluirInstancia(nomeInstancia: string) {
  await fetch(`${baseUrl()}/instance/delete/${encodeURIComponent(nomeInstancia)}`, {
    method: "DELETE",
    headers: headers(),
  });
}

/** numeroE164 sem "+". Retorna o payload — key.id é o ID da mensagem. */
export async function enviarTexto(nomeInstancia: string, numeroE164: string, texto: string) {
  return req(`/message/sendText/${encodeURIComponent(nomeInstancia)}`, {
    method: "POST",
    body: JSON.stringify({ number: numeroE164, text: texto }),
  });
}
