/**
 * Quem perdeu o acesso (cancelou e o período pago acabou, ou o pagamento foi
 * recusado e a carência passou) não pode continuar disparando: as campanhas
 * ativas (WhatsApp, e-mail, LinkedIn) ficam pausadas e as automações,
 * desligadas. Nada é apagado; ao assinar de novo, a pessoa retoma na tela.
 * A regra de acesso é a mesma do site (src/lib/acesso-regras.ts).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { COLUNAS_ACESSO, motivoBloqueio, type PerfilAcesso } from "../src/lib/acesso-regras";

const CAMPANHAS = ["dispatch_campaigns", "email_campaigns", "linkedin_campaigns"] as const;

export async function tickAcesso(sb: SupabaseClient, log: (msg: string) => void): Promise<void> {
  // Só quem tem algo rodando interessa: parte das campanhas e automações ativas.
  const consultas = await Promise.all([
    ...CAMPANHAS.map((t) => sb.from(t).select("user_id").eq("status", "ativa").limit(5000)),
    sb.from("automation_flows").select("user_id").eq("ativo", true).limit(5000),
  ]);
  const donos = new Set<string>();
  for (const c of consultas) for (const r of (c.data ?? []) as { user_id: string }[]) donos.add(r.user_id);
  if (!donos.size) return;

  const { data: perfis, error } = await sb.from("profiles").select(`id, ${COLUNAS_ACESSO}`).in("id", [...donos]);
  // Sem a migration 0047 (acesso_ate) ainda não há o que conferir.
  if (error) {
    if (!/acesso_ate/.test(error.message)) log(`erro ao ler perfis: ${error.message}`);
    return;
  }
  const agora = Date.now();
  const bloqueados = ((perfis ?? []) as unknown as (PerfilAcesso & { id: string })[])
    .filter((p) => motivoBloqueio(p, agora))
    .map((p) => p.id);
  if (!bloqueados.length) return;

  for (const tabela of CAMPANHAS) {
    const { error: e } = await sb.from(tabela).update({ status: "pausada" }).eq("status", "ativa").in("user_id", bloqueados);
    if (e) log(`não pausou ${tabela}: ${e.message}`);
  }
  const { error: e } = await sb.from("automation_flows").update({ ativo: false }).eq("ativo", true).in("user_id", bloqueados);
  if (e) log(`não desligou automações: ${e.message}`);
  log(`campanhas e automações pausadas de ${bloqueados.length} conta(s) sem acesso`);
}
