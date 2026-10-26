import { createAdminClient } from "@/lib/supabase/admin";
import { tokenWebhookConfere } from "@/lib/webhook-token";

/** Descadastro dos e-mails de retomada (link no rodapé de cada e-mail). */
function pagina(titulo: string, texto: string, status = 200) {
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${titulo}</title></head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#050706;color:#f2f5f3;font-family:system-ui,sans-serif">
<main style="max-width:420px;padding:32px;text-align:center"><h1 style="font-size:22px">${titulo}</h1><p style="color:#9aa69f;line-height:1.5">${texto}</p></main></body></html>`;
  return new Response(html, { status, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("u") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id) || !(await tokenWebhookConfere(`retomada:${id}`, url.searchParams.get("t")))) {
    return pagina("Link inválido", "Este link de descadastro não é válido.", 400);
  }
  await createAdminClient().from("profiles").update({ emails_retomada_off: true }).eq("id", id);
  return pagina("Pronto", "Você não vai mais receber estes e-mails do Leadmatic.");
}
