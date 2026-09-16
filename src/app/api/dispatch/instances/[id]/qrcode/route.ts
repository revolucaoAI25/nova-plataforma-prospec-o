import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { obterInstancia } from "@/lib/dispatch-db";
import { obterQrcode } from "@/lib/integrations/evolution-api";

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
    const data = await obterQrcode(instancia.evolution_instance_name);
    return NextResponse.json({ qrcode: data.base64 || data.qrcode?.base64 || null, pairingCode: data.pairingCode || null });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
