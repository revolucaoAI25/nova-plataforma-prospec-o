import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ErroDatafy, parceiroDatafyConfigurado } from "@/lib/integrations/datafy-parceiro";
import { ErroCanalOficial, iniciarConexaoOficial } from "@/lib/whatsapp-oficial-canal";

/** "Conectar WhatsApp oficial": devolve o link da janela de conexão (ou reativa o número já conectado). */
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!(await parceiroDatafyConfigurado())) {
    return NextResponse.json({ error: "A conexão com a API oficial ainda não está disponível. Fale com o suporte." }, { status: 503 });
  }
  try {
    return NextResponse.json(await iniciarConexaoOficial(user.id));
  } catch (err) {
    if (err instanceof ErroCanalOficial) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[oficial/conectar]", (err as Error).message);
    const conta = err instanceof ErroDatafy && err.status === 403;
    return NextResponse.json(
      { error: conta ? "A conexão com a API oficial está indisponível no momento. Nossa equipe já foi avisada." : "Não foi possível iniciar a conexão agora. Tente novamente em instantes." },
      { status: 502 },
    );
  }
}
