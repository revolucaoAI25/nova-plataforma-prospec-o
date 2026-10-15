export function apenasDigitos(s: string | null | undefined): string {
  return (s ?? "").replace(/\D/g, "");
}

/**
 * Converte um telefone em formato livre para E.164 sem o "+" (formato
 * aceito pela Evolution API), assumindo DDI padrão (Brasil) quando ausente.
 * Portado de modules/phone_utils.py.
 */
export function normalizarE164(numero: string, ddiPadrao = "55"): string {
  const d = apenasDigitos(numero);
  if (!d) return "";

  if (d.startsWith(ddiPadrao) && (d.length === 12 || d.length === 13)) return d;
  if (d.length === 10 || d.length === 11) return `${ddiPadrao}${d}`;
  if (d.length >= 12) return d;
  return "";
}

/** Formata um E.164 brasileiro para exibição: 5511999999999 → (11) 99999-9999. */
export function formatarExibicao(numeroE164: string): string {
  let d = apenasDigitos(numeroE164);
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) d = d.slice(2);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return numeroE164;
}

/**
 * Lead com celular do sócio (busca por CNPJ com "Buscar o celular do
 * sócio"): o disparo vai para o celular dele e o telefone da empresa fica
 * guardado em `telefone_empresa`. Sem celular do sócio, o lead não muda.
 */
export function preferirCelularDoSocio<T extends { telefone?: string | null; celular_socio?: string | null }>(lead: T): T {
  if (!lead.celular_socio) return lead;
  return { ...lead, telefone: lead.celular_socio, telefone_empresa: lead.telefone ?? "" };
}

/**
 * Para qual telefone do lead o disparo de WhatsApp vai. O lead pode ter o
 * celular do sócio (busca por CNPJ ou enriquecimento), o telefone da
 * empresa e um segundo telefone da base — a escolha fica no nó de disparo
 * do fluxo e na inscrição manual da campanha.
 */
export const DESTINOS_TELEFONE = [
  { id: "padrao", rotulo: "Celular do sócio; se não tiver, o telefone da empresa" },
  { id: "socio", rotulo: "Só o celular do sócio" },
  { id: "empresa", rotulo: "Telefone da empresa" },
  { id: "segundo", rotulo: "Segundo telefone da empresa" },
] as const;

export type DestinoTelefone = (typeof DESTINOS_TELEFONE)[number]["id"];

const tx = (v: unknown) => (v === null || v === undefined ? "" : String(v).trim());

export function telefoneDeDestino(lead: Record<string, unknown>, destino: DestinoTelefone = "padrao"): string {
  const socio = tx(lead.socio_celular) || tx(lead.celular_socio);
  // Depois de preferirCelularDoSocio (ou do nó de celular do sócio) o
  // `telefone` já é o celular dele e o da empresa fica em `telefone_empresa`.
  const empresa = tx(lead.telefone_empresa) || (tx(lead.telefone) !== socio ? tx(lead.telefone) : "");
  switch (destino) {
    case "socio":
      return socio;
    case "empresa":
      return empresa;
    case "segundo":
      return tx(lead.telefone2);
    default:
      return socio || tx(lead.telefone);
  }
}

/** O lead com `telefone` trocado pelo destino escolhido (sem destino, `telefone` vazio). */
export function comTelefoneDeDestino<T extends Record<string, unknown>>(lead: T, destino: DestinoTelefone): T {
  return { ...lead, telefone: telefoneDeDestino(lead, destino) };
}
