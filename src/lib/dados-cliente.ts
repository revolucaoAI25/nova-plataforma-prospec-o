import { z } from "zod";
import { normalizarE164 } from "@/lib/phone";

/** Nome, telefone e empresa do cliente (perfil). Texto vazio vira null. */
const texto = (max: number) =>
  z.string().trim().max(max).transform((v) => v || null).nullable().optional();

export const dadosClienteSchema = z.object({
  nome: texto(120),
  empresa: texto(160),
  telefone: z
    .string()
    .trim()
    .max(30)
    .nullable()
    .optional()
    .transform((v, ctx) => {
      if (v === undefined) return undefined;
      if (!v) return null;
      const e164 = normalizarE164(v);
      if (!e164) {
        ctx.addIssue({ code: "custom", message: "Telefone inválido — use DDD + número." });
        return z.NEVER;
      }
      return e164;
    }),
});

export type DadosCliente = z.infer<typeof dadosClienteSchema>;

/** Só as chaves enviadas (undefined = não mexer). */
export function camposDadosCliente(d: DadosCliente): Record<string, string | null> {
  return Object.fromEntries(Object.entries(d).filter(([, v]) => v !== undefined)) as Record<string, string | null>;
}

/** Primeira mensagem de erro de validação, pra devolver na API. */
export function erroValidacao(e: z.ZodError): string {
  return e.issues[0]?.message || "Dados inválidos.";
}

/**
 * Pré-preenche o questionário de prospecção com o que já veio do cadastro
 * (nome da empresa e quem assina as mensagens) — só onde o cliente ainda
 * não respondeu.
 */
export function respostasComDadosDoPerfil<T extends { empresaNome?: string; remetenteNome?: string }>(
  respostas: T,
  perfil: { nome: string | null; empresa: string | null } | null,
): T {
  if (!perfil) return respostas;
  return {
    ...respostas,
    ...(!respostas.empresaNome?.trim() && perfil.empresa ? { empresaNome: perfil.empresa } : {}),
    ...(!respostas.remetenteNome?.trim() && perfil.nome ? { remetenteNome: perfil.nome } : {}),
  };
}
