import { NextResponse } from "next/server";
import { z } from "zod";
import { dentroDoLimite, ipDaRequisicao } from "@/lib/limite-tentativas";
import { origemDaRequisicao } from "@/lib/rastreamento/servidor";
import { registrarLeadLP } from "@/lib/lp-leads";

/**
 * Preenchimento parcial dos formulários de contratação e do teste grátis
 * (rota pública): assim que a pessoa digita o e-mail ou o WhatsApp, ela
 * entra no quadro de leads do admin, mesmo que saia sem concluir. Nunca
 * recebe senha nem CPF/CNPJ.
 */

const texto = (max: number) => z.string().trim().max(max).optional().nullable();
const schema = z.object({
  nome: texto(120),
  email: texto(200),
  telefone: texto(30),
  empresa: texto(160),
  pagina: z.enum(["assinar", "teste"]),
  plano: texto(80),
  ciclo: z.enum(["mensal", "anual"]).optional().nullable(),
});

const ROBO = /bot|crawler|spider|preview|facebookexternalhit|headless/i;

export async function POST(request: Request) {
  if (ROBO.test(request.headers.get("user-agent") ?? "")) return new NextResponse(null, { status: 204 });
  if (!dentroDoLimite(`lp-lead:${ipDaRequisicao(request)}`, 30, 10 * 60_000)) return new NextResponse(null, { status: 429 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  const d = parsed.data;
  const emailOk = Boolean(d.email && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email));
  const telefoneOk = (d.telefone ?? "").replace(/\D/g, "").length >= 10;
  if (!emailOk && !telefoneOk) return new NextResponse(null, { status: 204 });

  await registrarLeadLP({
    etapa: "preencheu",
    origem: origemDaRequisicao(request),
    dados: { ...d, email: emailOk ? d.email : null, telefone: telefoneOk ? d.telefone : null },
  });
  return new NextResponse(null, { status: 204 });
}
