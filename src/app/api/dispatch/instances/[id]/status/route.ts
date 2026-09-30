import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { obterInstancia, atualizarInstancia } from "@/lib/dispatch-db";
import { configurarWebhookMensagens, statusENumero } from "@/lib/integrations/evolution-api";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const instancia = await obterInstancia(supabase, id);
  if (!instancia || instancia.canal !== "evolution" || !instancia.evolution_instance_name) {
    return NextResponse.json({ error: "Instância inválida." }, { status: 404 });
  }

  try {
    const { estado, numero } = await statusENumero(instancia.evolution_instance_name);
    const status = estado === "open" ? "conectado" : estado === "connecting" ? "conectando" : "desconectado";
    if (status !== instancia.status || (numero && numero !== instancia.numero_conectado)) {
      await atualizarInstancia(supabase, id, { status, numero_conectado: numero || instancia.numero_conectado });
    }
    // Número conectado: registra o webhook de respostas (uma vez) — é ele
    // que tira da cadência quem respondeu e move o card do funil.
    if (status === "conectado" && !instancia.webhook_configurado_em) {
      const ok = await configurarWebhookMensagens(instancia.evolution_instance_name).catch(() => false);
      if (ok) await atualizarInstancia(supabase, id, { webhook_configurado_em: new Date().toISOString() });
    }
    return NextResponse.json({ status, numero: numero || instancia.numero_conectado });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
