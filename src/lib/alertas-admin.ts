import { createAdminClient } from "@/lib/supabase/admin";
import { configPlataforma } from "@/lib/platform-settings";
import { enviarEmail, textoParaHtml } from "@/lib/integrations/resend";

/**
 * Avisos para o admin (migration 0048): aparecem no topo das telas de quem é
 * admin e vão por e-mail. Cada `chave` vira um aviso só (repetir a mesma
 * chave não faz nada), então dá para chamar a cada verificação sem lotar a
 * caixa de entrada. Nunca derruba quem chama: falhas só vão para o log.
 */

export interface AlertaAdmin {
  chave: string;
  nivel: "aviso" | "critico";
  titulo: string;
  mensagem: string;
  link?: string | null;
}

export interface AlertaAdminRow extends AlertaAdmin {
  id: number;
  criado_em: string;
}

/** Para quem vai o e-mail: o configurado em /admin ou, sem ele, todos os admins. */
async function destinatarios(): Promise<string[]> {
  const configurado = (await configPlataforma("email_alertas_admin", process.env.EMAIL_ALERTAS_ADMIN)).trim();
  if (configurado) return configurado.split(/[,;\s]+/).filter((e) => e.includes("@"));
  const { data } = await createAdminClient().from("profiles").select("email").eq("role", "admin");
  return ((data ?? []) as { email: string | null }[]).map((p) => p.email ?? "").filter((e) => e.includes("@"));
}

export async function registrarAlertaAdmin(alerta: AlertaAdmin): Promise<void> {
  try {
    const { data, error } = await createAdminClient()
      .from("alertas_admin")
      .upsert({ ...alerta, link: alerta.link ?? null }, { onConflict: "chave", ignoreDuplicates: true })
      .select("id");
    if (error) {
      console.error("[alertas-admin] não registrou", alerta.chave, error.message);
      return;
    }
    if (!data?.length) return; // já avisado

    const remetente = (await configPlataforma("email_remetente_plataforma", process.env.EMAIL_REMETENTE_PLATAFORMA)).trim();
    const para = await destinatarios();
    if (!remetente || !para.length) return;
    const texto = `${alerta.mensagem}${alerta.link ? `\n\n${alerta.link}` : ""}\n\n—\nAviso automático do Leadmatic (só para administradores).`;
    const assunto = `${alerta.nivel === "critico" ? "[Urgente] " : ""}${alerta.titulo}`;
    for (const to of para.slice(0, 10)) {
      await enviarEmail({ from: remetente, to, subject: assunto, text: texto, html: textoParaHtml(texto) }).catch((err: Error) =>
        console.error("[alertas-admin] e-mail não enviado para", to, err.message),
      );
    }
  } catch (err) {
    console.error("[alertas-admin] falha ao avisar", alerta.chave, err);
  }
}

/** Avisos ainda não resolvidos, do mais recente para o mais antigo. */
export async function alertasAbertos(limite = 5): Promise<AlertaAdminRow[]> {
  const { data, error } = await createAdminClient()
    .from("alertas_admin")
    .select("id, chave, nivel, titulo, mensagem, link, criado_em")
    .is("resolvido_em", null)
    .order("criado_em", { ascending: false })
    .limit(limite);
  if (error) return []; // sem a migration 0048
  return (data ?? []) as AlertaAdminRow[];
}
