import type { SupabaseClient } from "@supabase/supabase-js";
import { getProfile } from "../src/lib/credits";
import { gerarPlanosOnboarding } from "../src/lib/onboarding/ia";
import { respostasSchema } from "../src/lib/onboarding/questionario";

// Lease curto com heartbeat: cada etapa da geração (gerar, avaliar,
// revisar…) renova `processando_desde`. Se o worker cair no meio, outro
// tick retoma depois de LEASE_MS sem atualização.
const LEASE_MS = 12 * 60_000;
const MAX_TENTATIVAS = 3;

export async function tickOnboarding(sb: SupabaseClient, log: (msg: string) => void) {
  const expirado = new Date(Date.now() - LEASE_MS).toISOString();
  const { data: pendentes } = await sb
    .from("onboarding")
    .select("user_id, respostas, tentativas, processando_desde")
    .eq("status", "gerando")
    .or(`processando_desde.is.null,processando_desde.lt.${expirado}`)
    .limit(3);

  for (const row of pendentes ?? []) {
    const agora = new Date().toISOString();
    let claim = sb.from("onboarding").update({ processando_desde: agora }).eq("user_id", row.user_id).eq("status", "gerando");
    claim = row.processando_desde ? claim.eq("processando_desde", row.processando_desde) : claim.is("processando_desde", null);
    const { data: reservado } = await claim.select("user_id").maybeSingle();
    if (!reservado) continue;

    const heartbeat = async (msg: string) => {
      log(`${row.user_id}: ${msg}`);
      await sb.from("onboarding").update({ processando_desde: new Date().toISOString() }).eq("user_id", row.user_id);
    };

    try {
      const profile = await getProfile(sb, row.user_id);
      if (!profile) throw new Error("Perfil não encontrado.");
      const respostas = respostasSchema.parse(row.respostas ?? {});
      const resultado = await gerarPlanosOnboarding(sb, profile, respostas, (m) => void heartbeat(m));
      const fim = new Date().toISOString();
      await sb
        .from("onboarding")
        .update({ status: "pronto", resultado, erro: null, gerado_em: fim, processando_desde: null, atualizado_em: fim })
        .eq("user_id", row.user_id);
      log(`${row.user_id}: ${resultado.planos.length} plano(s) gerado(s)`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const tentativas = (row.tentativas ?? 0) + 1;
      const desistir = tentativas >= MAX_TENTATIVAS;
      await sb
        .from("onboarding")
        .update({
          status: desistir ? "erro" : "gerando",
          erro: msg.slice(0, 500),
          tentativas,
          processando_desde: null,
          atualizado_em: new Date().toISOString(),
        })
        .eq("user_id", row.user_id);
      log(`${row.user_id}: falha na geração (tentativa ${tentativas}/${MAX_TENTATIVAS}): ${msg}`);
    }
  }
}
