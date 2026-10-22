import http from "node:http";
import https from "node:https";
import dns from "node:dns";
import net from "node:net";

/**
 * Requisição HTTP para um endereço que o USUÁRIO escolheu (módulo
 * "Requisição HTTP" das automações). Roda no nosso servidor, então não
 * pode virar porta de entrada para a rede interna:
 *
 * - só http/https;
 * - o host é resolvido aqui e a conexão é recusada se QUALQUER endereço
 *   dele cair em faixa privada, local, link-local (metadados da nuvem em
 *   169.254.169.254), CGNAT, multicast ou reservada. A checagem fica no
 *   `lookup` da própria conexão, então um DNS que troca de resposta entre
 *   a checagem e a conexão não passa;
 * - não segue redirecionamento (um 3xx volta como resposta, sem seguir);
 * - tempo limite e tamanho máximo da resposta.
 */

const BLOQUEADOS = new net.BlockList();
for (const [rede, prefixo] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12],
  ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.88.99.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15],
  ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) BLOQUEADOS.addSubnet(rede, prefixo, "ipv4");
for (const [rede, prefixo] of [
  ["::", 128], ["::1", 128], ["64:ff9b::", 96], ["64:ff9b:1::", 48], ["100::", 64], ["2001:db8::", 32],
  ["fc00::", 7], ["fe80::", 10], ["fec0::", 10], ["ff00::", 8],
] as const) BLOQUEADOS.addSubnet(rede, prefixo, "ipv6");

/** Só para os testes automatizados, que sobem um servidor local. */
export const configHttpSeguro = { permitirRedeInterna: false };

export function ipBloqueado(ip: string): boolean {
  if (configHttpSeguro.permitirRedeInterna) return false;
  const tipo = net.isIP(ip);
  if (tipo === 4) return BLOQUEADOS.check(ip, "ipv4");
  if (tipo === 6) return BLOQUEADOS.check(ip, "ipv6");
  return true;
}

export class ErroHttpSeguro extends Error {}

type Endereco = { address: string; family: number };

const lookupSeguro = ((hostname: string, opcoes: dns.LookupOptions, callback: (...args: unknown[]) => void) => {
  dns.lookup(hostname, { all: true, family: opcoes.family }, (err, enderecos: Endereco[]) => {
    if (err) return callback(err);
    if (!enderecos.length) return callback(new ErroHttpSeguro(`Não foi possível encontrar o endereço ${hostname}.`));
    if (enderecos.some((e) => ipBloqueado(e.address))) {
      return callback(new ErroHttpSeguro("Endereço de rede interna não é permitido."));
    }
    if (opcoes.all) return callback(null, enderecos);
    callback(null, enderecos[0].address, enderecos[0].family);
  });
}) as unknown as net.LookupFunction;

export interface OpcoesHttp {
  metodo: string;
  cabecalhos: Record<string, string>;
  corpo?: string;
  timeoutMs?: number;
  maxBytes?: number;
}

export interface RespostaHttp {
  status: number;
  corpo: string;
  truncado: boolean;
}

/** Valida a URL antes de qualquer conexão; devolve o erro em português ou a URL pronta. */
export function conferirUrl(texto: string): { ok: true; url: URL } | { ok: false; erro: string } {
  let url: URL;
  try {
    url = new URL(texto.trim());
  } catch {
    return { ok: false, erro: "URL inválida." };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return { ok: false, erro: "A URL precisa começar com http:// ou https://." };
  if (url.username || url.password) return { ok: false, erro: "Coloque usuário e senha num cabeçalho, não na URL." };
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (!host) return { ok: false, erro: "URL sem endereço." };
  if (/^localhost$|\.localhost$|\.local$|\.internal$/i.test(host) && !configHttpSeguro.permitirRedeInterna) {
    return { ok: false, erro: "Endereço de rede interna não é permitido." };
  }
  // IP escrito direto na URL não passa pelo lookup: confere aqui.
  if (net.isIP(host) && ipBloqueado(host)) return { ok: false, erro: "Endereço de rede interna não é permitido." };
  return { ok: true, url };
}

export function requisicaoSegura(urlTexto: string, opcoes: OpcoesHttp): Promise<RespostaHttp> {
  const conferida = conferirUrl(urlTexto);
  if (!conferida.ok) return Promise.reject(new ErroHttpSeguro(conferida.erro));
  const { url } = conferida;
  const timeoutMs = opcoes.timeoutMs ?? 10_000;
  const maxBytes = opcoes.maxBytes ?? 64 * 1024;
  const corpo = opcoes.corpo !== undefined ? Buffer.from(opcoes.corpo, "utf8") : undefined;
  const cabecalhos: Record<string, string> = { ...opcoes.cabecalhos };
  if (corpo) cabecalhos["Content-Length"] = String(corpo.length);

  return new Promise((resolve, reject) => {
    const mod = url.protocol === "https:" ? https : http;
    const req = mod.request(url, { method: opcoes.metodo, headers: cabecalhos, lookup: lookupSeguro }, (res) => {
      const partes: Buffer[] = [];
      let tamanho = 0;
      let truncado = false;
      res.on("data", (pedaco: Buffer) => {
        if (truncado) return;
        if (tamanho + pedaco.length > maxBytes) {
          partes.push(pedaco.subarray(0, maxBytes - tamanho));
          tamanho = maxBytes;
          truncado = true;
          res.destroy();
          terminar();
          return;
        }
        partes.push(pedaco);
        tamanho += pedaco.length;
      });
      let terminou = false;
      const terminar = () => {
        if (terminou) return;
        terminou = true;
        clearTimeout(relogio);
        resolve({ status: res.statusCode ?? 0, corpo: Buffer.concat(partes).toString("utf8"), truncado });
      };
      res.on("end", terminar);
      res.on("error", (e) => (truncado ? terminar() : falhar(e)));
    });
    let falhou = false;
    const falhar = (e: Error) => {
      if (falhou) return;
      falhou = true;
      clearTimeout(relogio);
      reject(e);
    };
    const relogio = setTimeout(() => {
      req.destroy(new ErroHttpSeguro(`Sem resposta em ${Math.max(1, Math.round(timeoutMs / 1000))} s.`));
    }, timeoutMs);
    req.on("error", falhar);
    if (corpo) req.write(corpo);
    req.end();
  });
}
