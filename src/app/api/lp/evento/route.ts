import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { dentroDoLimite, ipDaRequisicao } from "@/lib/limite-tentativas";

/**
 * Passos de quem visita a página de vendas (rota pública, chamada por
 * sendBeacon). Só aceita os eventos conhecidos, com campos curtos, e ignora
 * robôs; o painel /admin/funil-lp lê o resultado.
 */

const EVENTOS = ["pagina_vista", "secao_vista", "clique", "checkout_enviado", "teste_enviado"] as const;
const curto = (max: number) => z.string().trim().max(max).nullish();

const schema = z.object({
  visitante: z.string().trim().min(8).max(64),
  sessao: curto(64),
  evento: z.enum(EVENTOS),
  pagina: curto(120),
  alvo: curto(80),
  referrer: curto(120),
  dispositivo: z.enum(["celular", "tablet", "computador"]).nullish(),
  utm_source: curto(200),
  utm_medium: curto(200),
  utm_campaign: curto(200),
  utm_content: curto(200),
  utm_term: curto(200),
});

const ROBO = /bot|crawl|spider|slurp|facebookexternalhit|headless|lighthouse|preview|monitor/i;

export async function POST(request: Request) {
  if (ROBO.test(request.headers.get("user-agent") ?? "")) return new NextResponse(null, { status: 204 });
  if (!dentroDoLimite(`lp-evento:${ipDaRequisicao(request)}`, 240, 60_000)) return new NextResponse(null, { status: 429 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return new NextResponse(null, { status: 400 });
  const d = parsed.data;

  const { error } = await createAdminClient().from("lp_eventos").insert({
    visitante: d.visitante,
    sessao: d.sessao ?? null,
    evento: d.evento,
    pagina: d.pagina ?? null,
    alvo: d.alvo ?? null,
    referrer: d.referrer ?? null,
    dispositivo: d.dispositivo ?? null,
    utm_source: d.utm_source ?? null,
    utm_medium: d.utm_medium ?? null,
    utm_campaign: d.utm_campaign ?? null,
    utm_content: d.utm_content ?? null,
    utm_term: d.utm_term ?? null,
  });
  if (error) console.error("[lp/evento] falha ao gravar", error.message);
  return new NextResponse(null, { status: 204 });
}
