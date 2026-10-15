import type { SupabaseClient } from "@supabase/supabase-js";
import { partesTelefone } from "@/lib/contatos";

// Detalhe de um negócio do funil: em quais campanhas cada contato do card
// está (WhatsApp, e-mail, LinkedIn), em que pé, e as últimas mensagens que
// saíram — mesmo casamento por contato que a detecção de resposta usa
// (funil-automacao.ts), só que de leitura.

export type CanalAtividade = "whatsapp" | "email" | "linkedin";

export interface CampanhaDoContato {
  canal: CanalAtividade;
  campanhaId: string;
  campanha: string;
  contato: string;
  status: string;
  atualizadoEm: string;
}

export interface MensagemDoContato {
  canal: CanalAtividade;
  campanha: string;
  contato: string;
  enviadoEm: string;
  status: "sucesso" | "erro";
  corpo: string | null;
  erro: string | null;
  entregueEm: string | null;
  lidoEm: string | null;
}

interface Alvo {
  id: string;
  status: string;
  atualizado_em: string;
  campaign_id: string;
  contato: string;
  campanha: string;
}

const TABELAS: Record<CanalAtividade, { alvos: string; campanhas: string; log: string; contato: string }> = {
  whatsapp: { alvos: "dispatch_targets", campanhas: "dispatch_campaigns", log: "dispatch_messages_log", contato: "telefone" },
  email: { alvos: "email_targets", campanhas: "email_campaigns", log: "email_messages_log", contato: "email" },
  linkedin: { alvos: "linkedin_targets", campanhas: "linkedin_campaigns", log: "linkedin_messages_log", contato: "linkedin_url" },
};

async function alvosDoContato(sb: SupabaseClient, userId: string, chave: string): Promise<[CanalAtividade, Alvo[]] | null> {
  const tel = partesTelefone(chave);
  const canal: CanalAtividade | null = tel ? "whatsapp" : chave.startsWith("email:") ? "email" : chave.startsWith("li:") ? "linkedin" : null;
  if (!canal) return null;
  const t = TABELAS[canal];
  let q = sb
    .from(t.alvos)
    .select(`id, status, atualizado_em, campaign_id, ${t.contato}, ${t.campanhas}!inner(user_id, nome)`)
    .eq(`${t.campanhas}.user_id`, userId)
    .limit(50);
  if (tel) q = q.like("telefone", `%${tel.final8}`);
  else if (canal === "email") q = q.ilike("email", chave.slice(6));
  else q = q.ilike("linkedin_url", `%/in/${chave.slice(3)}%`);
  const { data } = await q;
  const linhas = (data ?? []) as unknown as Array<Record<string, unknown>>;
  const alvos = linhas
    .filter((r) => {
      if (!tel) return true;
      const d = String(r.telefone).replace(/\D/g, "").replace(/^55(?=\d{10,})/, "");
      return d.slice(0, 2) === tel.ddd;
    })
    .map((r) => {
      const camp = r[t.campanhas] as { nome?: string } | null;
      return {
        id: String(r.id), status: String(r.status), atualizado_em: String(r.atualizado_em), campaign_id: String(r.campaign_id),
        contato: String(r[t.contato] ?? ""), campanha: camp?.nome ?? "Campanha",
      };
    });
  return [canal, alvos];
}

export async function historicoDoCard(
  sb: SupabaseClient, userId: string, contatos: string[],
): Promise<{ campanhas: CampanhaDoContato[]; mensagens: MensagemDoContato[] }> {
  const porCanal = new Map<CanalAtividade, Alvo[]>();
  const resultados = await Promise.all(contatos.slice(0, 20).map((c) => alvosDoContato(sb, userId, c)));
  for (const r of resultados) {
    if (!r) continue;
    const [canal, alvos] = r;
    porCanal.set(canal, [...(porCanal.get(canal) ?? []), ...alvos]);
  }

  const campanhas: CampanhaDoContato[] = [];
  const mensagens: MensagemDoContato[] = [];
  for (const [canal, alvos] of porCanal) {
    const unicos = Array.from(new Map(alvos.map((a) => [a.id, a])).values());
    if (!unicos.length) continue;
    for (const a of unicos) {
      campanhas.push({ canal, campanhaId: a.campaign_id, campanha: a.campanha, contato: a.contato, status: a.status, atualizadoEm: a.atualizado_em });
    }
    const porId = new Map(unicos.map((a) => [a.id, a]));
    const { data } = await sb
      .from(TABELAS[canal].log)
      .select("target_id, enviado_em, status, corpo_enviado, erro_msg, entregue_em, lido_em")
      .in("target_id", [...porId.keys()])
      .order("enviado_em", { ascending: false })
      .limit(30);
    for (const m of (data ?? []) as Array<Record<string, unknown>>) {
      const alvo = porId.get(String(m.target_id));
      mensagens.push({
        canal,
        campanha: alvo?.campanha ?? "",
        contato: alvo?.contato ?? "",
        enviadoEm: String(m.enviado_em),
        status: m.status === "erro" ? "erro" : "sucesso",
        corpo: (m.corpo_enviado as string | null) ?? null,
        erro: (m.erro_msg as string | null) ?? null,
        entregueEm: (m.entregue_em as string | null) ?? null,
        lidoEm: (m.lido_em as string | null) ?? null,
      });
    }
  }
  campanhas.sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm));
  mensagens.sort((a, b) => b.enviadoEm.localeCompare(a.enviadoEm));
  return { campanhas, mensagens: mensagens.slice(0, 30) };
}
