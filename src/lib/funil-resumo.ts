import { telefonesDoLead, chaveTelefone, type TelefoneDoLead } from "@/lib/contatos";
import { nomeEmpresa, capitalizar } from "@/lib/mensagem";
import { formatarExibicao, normalizarE164 } from "@/lib/phone";

// Como um negócio do funil aparece na tela, a partir do `lead_snapshot`
// (que pode vir de qualquer origem: CNPJ, Maps, LinkedIn, Instagram,
// planilha, cadastro manual) — usado pelo card e pelo detalhe.

export interface OutroContato {
  nome?: string;
  cargo?: string;
  telefone?: string;
  rotulo: string;
  whatsapp?: boolean;
  email?: string;
}

export interface TelefoneExibido extends TelefoneDoLead {
  exibicao: string;
  e164: string;
  nome?: string;
  cargo?: string;
}

const txt = (v: unknown) => (v === null || v === undefined ? "" : String(v).trim());

export function resumoDoCard(s: Record<string, unknown>) {
  // Cadastro manual e LinkedIn/Instagram: `nome` é a pessoa. CNPJ/Maps: a empresa.
  const nomeEhPessoa = "empresa" in s || Boolean(s.linkedin_url || s.username);
  const empresaBruta = txt(s.empresa) || txt(s.empresa_atual) || txt(s.razao_social) || txt(s.nome_fantasia) || (nomeEhPessoa ? "" : txt(s.nome));
  const pessoaBruta = txt(s.nome_completo) || (nomeEhPessoa ? txt(s.nome) : "") || txt(s.socio_nome) || txt(s.socio_principal);
  const empresa = empresaBruta ? nomeEmpresa(empresaBruta) : "";
  const pessoa = pessoaBruta ? capitalizar(pessoaBruta) : "";
  const cargo = txt(s.socio_cargo) || txt(s.cargo);
  const outros = (Array.isArray(s.outros_contatos) ? s.outros_contatos : []) as OutroContato[];

  const telefones: TelefoneExibido[] = telefonesDoLead(s).map((t) => ({
    ...t,
    exibicao: formatarExibicao(normalizarE164(t.numero)) || t.numero,
    e164: normalizarE164(t.numero),
    ...(t.rotulo === "Celular do sócio" && pessoa ? { nome: pessoa, cargo } : {}),
  }));
  const vistos = new Set(telefones.map((t) => chaveTelefone(t.numero)));
  for (const o of outros) {
    const chave = chaveTelefone(o.telefone);
    if (!o.telefone || !chave || vistos.has(chave)) continue;
    vistos.add(chave);
    telefones.push({
      numero: o.telefone, rotulo: o.rotulo, whatsapp: o.whatsapp,
      exibicao: formatarExibicao(normalizarE164(o.telefone)) || o.telefone, e164: normalizarE164(o.telefone),
      nome: o.nome ? capitalizar(o.nome) : undefined, cargo: o.cargo,
    });
  }
  const emails = Array.from(new Set([txt(s.email), ...outros.map((o) => txt(o.email))].filter(Boolean)));

  return {
    titulo: empresa || pessoa || "Sem nome",
    subtitulo: empresa && pessoa ? [pessoa, cargo].filter(Boolean).join(" · ") : "",
    empresa,
    pessoa,
    cargo,
    telefones,
    emails,
    linkedin: txt(s.linkedin_url),
    instagram: txt(s.username),
  };
}
