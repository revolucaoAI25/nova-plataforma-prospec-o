// Rastreamento no servidor: origem da conta (lida dos cookies no cadastro),
// passos do funil gravados direto no banco (conta criada, teste iniciado,
// compra) e a API de Conversões da Meta, que manda o mesmo evento do Pixel
// pelo servidor. Com o mesmo `event_id` dos dois lados, a Meta conta uma vez
// só e ainda recebe a compra, que acontece fora da página (na fatura do
// Asaas) e muitas vezes sem a pessoa voltar para o site.
//
// Nada aqui pode derrubar o fluxo principal: toda falha é registrada no log
// e engolida.
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { configPlataforma } from "@/lib/platform-settings";
import { urlBaseApp } from "@/lib/webhook-token";
import type { RastreamentoConta } from "@/lib/database.types";

const COOKIE_VISITANTE = "lm_vid";
const COOKIE_ORIGEM = "lm_origem";
const VERSAO_API_META = process.env.META_API_VERSION || "v24.0";

function cookies(request: Request): Map<string, string> {
  const mapa = new Map<string, string>();
  for (const parte of (request.headers.get("cookie") ?? "").split(";")) {
    const i = parte.indexOf("=");
    if (i > 0) {
      try {
        mapa.set(parte.slice(0, i).trim(), decodeURIComponent(parte.slice(i + 1).trim()));
      } catch {
        // cookie malformado: ignora
      }
    }
  }
  return mapa;
}

function ipDe(request: Request): string | null {
  const encaminhado = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return encaminhado || request.headers.get("x-real-ip") || null;
}

/** Origem da pessoa no momento do cadastro: campanha, visitante, cookies da Meta, IP e navegador. */
export function origemDaRequisicao(request: Request): RastreamentoConta {
  const c = cookies(request);
  let origem: Record<string, string> = {};
  try {
    origem = JSON.parse(c.get(COOKIE_ORIGEM) || "{}");
  } catch {
    origem = {};
  }
  const texto = (v: unknown) => (typeof v === "string" && v ? v.slice(0, 200) : null);
  return {
    visitante: texto(c.get(COOKIE_VISITANTE)),
    fbp: texto(c.get("_fbp")),
    fbc: texto(c.get("_fbc")),
    ip: ipDe(request),
    navegador: texto(request.headers.get("user-agent")),
    utm_source: texto(origem.utm_source),
    utm_medium: texto(origem.utm_medium),
    utm_campaign: texto(origem.utm_campaign),
    utm_content: texto(origem.utm_content),
    utm_term: texto(origem.utm_term),
    pagina_entrada: texto(origem.pagina_entrada),
  };
}

/** Grava a origem no perfil, separado do resto (se a coluna ainda não existir, o cadastro segue igual). */
export async function salvarOrigemNoPerfil(userId: string, rastreamento: RastreamentoConta) {
  const { error } = await createAdminClient().from("profiles").update({ rastreamento }).eq("id", userId);
  if (error) console.error("[rastreamento] não gravou a origem da conta", userId, error.message);
}

/** Passo do funil registrado pelo servidor (conta criada, teste iniciado, compra). */
export async function registrarEventoServidor(evento: string, rastreamento: RastreamentoConta | null | undefined, userId: string, alvo?: string) {
  const r = rastreamento ?? {};
  const { error } = await createAdminClient().from("lp_eventos").insert({
    visitante: r.visitante || `conta:${userId}`,
    evento,
    alvo: alvo ?? null,
    user_id: userId,
    utm_source: r.utm_source ?? null,
    utm_medium: r.utm_medium ?? null,
    utm_campaign: r.utm_campaign ?? null,
    utm_content: r.utm_content ?? null,
    utm_term: r.utm_term ?? null,
  });
  if (error) console.error("[rastreamento] não gravou o evento", evento, error.message);
}

// ---------------------------------------------------------------- Meta

function hash(valor: string | null | undefined): string | undefined {
  const v = (valor ?? "").trim().toLowerCase();
  return v ? createHash("sha256").update(v).digest("hex") : undefined;
}

function semAcento(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export interface PessoaConversao {
  userId: string;
  email?: string | null;
  telefone?: string | null;
  nome?: string | null;
  rastreamento?: RastreamentoConta | null;
}

export interface EventoConversao {
  nome: "CompleteRegistration" | "StartTrial" | "Lead" | "InitiateCheckout" | "AddPaymentInfo" | "Purchase" | "Subscribe";
  /** O mesmo id usado no Pixel do navegador, para a Meta descartar a duplicata. */
  eventId: string;
  pessoa: PessoaConversao;
  /** Página em que a ação aconteceu (caminho, ex.: "/assinar"). */
  pagina: string;
  valor?: number;
  conteudo?: { id?: string; nome?: string };
}

/** Manda o evento para a API de Conversões. Sem pixel ou token configurados, não faz nada. */
export async function enviarConversaoMeta(ev: EventoConversao): Promise<void> {
  try {
    const [pixel, token, codigoTeste] = await Promise.all([
      configPlataforma("meta_pixel_id", process.env.META_PIXEL_ID),
      configPlataforma("meta_capi_token", process.env.META_CAPI_TOKEN),
      configPlataforma("meta_test_event_code", process.env.META_TEST_EVENT_CODE),
    ]);
    if (!pixel || !token) return;

    const p = ev.pessoa;
    const r = p.rastreamento ?? {};
    const partesNome = semAcento(p.nome ?? "").trim().split(/\s+/).filter(Boolean);
    const telefone = (p.telefone ?? "").replace(/\D/g, "");
    const userData: Record<string, unknown> = {
      em: hash(p.email) ? [hash(p.email)] : undefined,
      ph: telefone ? [hash(telefone)] : undefined,
      fn: partesNome[0] ? [hash(partesNome[0])] : undefined,
      ln: partesNome.length > 1 ? [hash(partesNome[partesNome.length - 1])] : undefined,
      country: [hash("br")],
      external_id: [hash(p.userId)],
      client_ip_address: r.ip || undefined,
      client_user_agent: r.navegador || undefined,
      fbp: r.fbp || undefined,
      fbc: r.fbc || undefined,
    };
    const base = urlBaseApp();
    const corpo: Record<string, unknown> = {
      data: [
        {
          event_name: ev.nome,
          event_time: Math.floor(Date.now() / 1000),
          event_id: ev.eventId,
          action_source: "website",
          event_source_url: base ? `${base}${ev.pagina}` : undefined,
          user_data: userData,
          custom_data: {
            currency: "BRL",
            ...(ev.valor !== undefined ? { value: Math.round(ev.valor * 100) / 100 } : {}),
            ...(ev.conteudo?.id ? { content_ids: [ev.conteudo.id], content_type: "product" } : {}),
            ...(ev.conteudo?.nome ? { content_name: ev.conteudo.nome } : {}),
          },
        },
      ],
      ...(codigoTeste ? { test_event_code: codigoTeste } : {}),
    };
    const resp = await fetch(`https://graph.facebook.com/${VERSAO_API_META}/${encodeURIComponent(pixel)}/events?access_token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) console.error("[meta-capi] evento recusado", ev.nome, resp.status, (await resp.text()).slice(0, 300));
  } catch (err) {
    console.error("[meta-capi] falha ao enviar", ev.nome, err);
  }
}
