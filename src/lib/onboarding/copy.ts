import type { MensagensPlano } from "./ia";
import { VARIAVEIS_DERIVADAS } from "@/lib/mensagem";

// Revisor determinístico das mensagens geradas: pega o que denuncia texto de
// IA ou de robô antes do cliente ver. O que dá pra consertar sem mudar o
// sentido é consertado aqui (travessão, atraso fora do padrão); o resto vira
// "problema de copy" que vai pro avaliador e força uma rodada de revisão.

/** Expressões que soam como IA, telemarketing ou e-mail de 2010. Comparação sem acento e sem caixa. */
const PROIBIDAS = [
  "espero que esteja bem", "espero que este", "espero que voce esteja", "venho por meio", "gostaria de apresentar",
  "prezado", "prezada", "caro cliente", "no mundo de hoje", "nos dias de hoje", "em um mundo", "cada vez mais competitivo",
  "solucao inovadora", "solucoes inovadoras", "revolucionar", "revolucione", "alavancar", "alavanque", "potencializar",
  "potencialize", "sinergia", "transformar o seu negocio", "transforme seu negocio", "transformar seu negocio",
  "leve seu negocio", "levar seu negocio", "proximo nivel", "oportunidade unica", "nao perca", "imperdivel",
  "incrivel", "fantastico", "sem compromisso", "estamos a disposicao", "fico a disposicao", "qualquer duvida estou",
  "atenciosamente", "cordialmente", "desbloquear", "jornada", "mergulhar", "robusto", "otimizar seus resultados",
  "de forma eficiente e eficaz", "vale ressaltar", "e importante destacar", "nao e apenas", "mais do que apenas",
  "so passando", "passando pra saber", "passando para saber", "conseguiu ver minha", "viu minha mensagem",
  "lembra de mim", "ultima tentativa", "[nome", "[empresa", "[seu nome", "<nome>",
];

const EMOJI = /\p{Extended_Pictographic}/gu;
const URL = /\bhttps?:\/\/|\bwww\./i;

export interface ProblemaCopy {
  onde: string;
  problema: string;
}

function semAcento(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Travessão e meia-risca no meio da frase são a assinatura mais comum de texto gerado — troca por vírgula. */
export function limparTracos(texto: string): string {
  return texto
    .replace(/\s+[—–]\s+/g, ", ")
    .replace(/[—–]/g, ", ")
    .replace(/,\s*,/g, ",")
    .replace(/,\s*([.!?])/g, "$1");
}

/**
 * Atrasos em múltiplos de 24h: a 1ª mensagem sai no horário comercial em
 * que a automação roda, e os follow-ups caem no mesmo horário dias depois,
 * nunca de madrugada. Também garante ordem crescente.
 */
function normalizarAtrasos<T extends { atrasoHoras: number }>(etapas: T[]): T[] {
  let anterior = -1;
  return etapas.map((e, i) => {
    let horas = i === 0 ? Math.max(0, Math.round(e.atrasoHoras / 24) * 24) : Math.max(24, Math.round(e.atrasoHoras / 24) * 24);
    if (horas <= anterior) horas = anterior + 24;
    anterior = horas;
    return { ...e, atrasoHoras: horas };
  });
}

export function normalizarMensagens(m: MensagensPlano): MensagensPlano {
  return {
    whatsapp: normalizarAtrasos(m.whatsapp.map((e) => ({ ...e, texto: limparTracos(e.texto.trim()) }))),
    email: normalizarAtrasos(m.email.map((e) => ({ ...e, assunto: limparTracos(e.assunto.trim()), corpo: limparTracos(e.corpo.trim()) }))),
    linkedinNota: m.linkedinNota ? limparTracos(m.linkedinNota.trim()) : null,
    linkedinMensagens: normalizarAtrasos(m.linkedinMensagens.map((e) => ({ ...e, texto: limparTracos(e.texto.trim()) }))),
    roteiroDm: m.roteiroDm ? limparTracos(m.roteiroDm.trim()) : null,
    // Planos gerados antes do teste A/B não têm o campo.
    testeAB: m.testeAB
      ? {
        whatsappAbertura: m.testeAB.whatsappAbertura?.trim() ? limparTracos(m.testeAB.whatsappAbertura.trim()) : null,
        emailAssunto: m.testeAB.emailAssunto?.trim() ? limparTracos(m.testeAB.emailAssunto.trim()) : null,
        linkedinNota: m.testeAB.linkedinNota?.trim() ? limparTracos(m.testeAB.linkedinNota.trim()) : null,
      }
      : null,
  };
}

function checarTexto(onde: string, texto: string, variaveisPermitidas: Set<string>, problemas: ProblemaCopy[]) {
  const normal = semAcento(texto);
  const achadas = PROIBIDAS.filter((p) => normal.includes(p));
  if (achadas.length) problemas.push({ onde, problema: `Expressões que soam robóticas ou genéricas: ${achadas.map((a) => `"${a}"`).join(", ")}.` });

  if (/(^|[^{])\{[a-z_]+\}(?!\})/i.test(texto)) problemas.push({ onde, problema: "Placeholder com uma chave só ({campo}) — use {{campo}}." });

  const emojis = texto.match(EMOJI)?.length ?? 0;
  if (emojis > 1) problemas.push({ onde, problema: `${emojis} emojis — use no máximo 1 (ou nenhum).` });
  if ((texto.match(/!/g)?.length ?? 0) > 1) problemas.push({ onde, problema: "Mais de uma exclamação — soa forçado." });
  if (/\b[A-ZÁÉÍÓÚÂÊÔÃÕÇ]{5,}\b/.test(texto.replace(/\{\{[^}]+\}\}/g, ""))) problemas.push({ onde, problema: "Palavra em CAIXA ALTA." });
  if (/^\s*[-•*]\s/m.test(texto)) problemas.push({ onde, problema: "Lista com marcadores — mensagem de prospecção é conversa, não apresentação." });
  if (/^\s*\{\{/.test(texto)) problemas.push({ onde, problema: "Começa com variável — se vier vazia, a mensagem abre quebrada." });

  // Base própria: qualquer coluna da planilha vira variável — não dá pra conferir aqui.
  if (variaveisPermitidas.has("<qualquer coluna da planilha>")) return;
  for (const [, bruto] of texto.matchAll(/\{\{\s*([^}|]+?)\s*(?:\|[^}]*)?\}\}/g)) {
    const nome = bruto.trim();
    if ((VARIAVEIS_DERIVADAS as readonly string[]).includes(nome)) continue;
    const base = nome.startsWith("enriquecimento_extra_") ? "enriquecimento_extra_<campo>" : nome;
    if (!variaveisPermitidas.has(base)) problemas.push({ onde, problema: `Variável {{${nome}}} não existe nesse caminho — vai sair em branco.` });
  }
}

/**
 * Revisão de uma mensagem solta (editores de cadência): mesmas regras do
 * revisor das sugestões, sem conferir variáveis — ali o lead pode vir de
 * qualquer fonte, e variável que falta já some sozinha no envio.
 */
export function revisarMensagem(
  canal: "whatsapp" | "email" | "linkedin_nota" | "linkedin", texto: string, indice = 0, assunto?: string,
): string[] {
  const problemas: ProblemaCopy[] = [];
  const livre = new Set(["<qualquer coluna da planilha>"]);
  checarTexto("", texto, livre, problemas);
  if (canal === "whatsapp") {
    const limite = indice === 0 ? 420 : 280;
    if (texto.length > limite) problemas.push({ onde: "", problema: `${texto.length} caracteres — no WhatsApp, até ${limite}.` });
    if (indice === 0 && URL.test(texto)) problemas.push({ onde: "", problema: "Link na primeira mensagem derruba entrega e resposta." });
    const semCumprimento = texto.replace(/tudo (bem|certo|bom|joia|jóia)\s*\?/gi, "");
    if ((semCumprimento.match(/\?/g)?.length ?? 0) > 1) problemas.push({ onde: "", problema: "Mais de uma pergunta — faça uma só." });
  }
  if (canal === "email") {
    if (assunto !== undefined) {
      checarTexto("", assunto, livre, problemas);
      if (assunto.length > 50) problemas.push({ onde: "", problema: `Assunto com ${assunto.length} caracteres — até 50.` });
    }
    const palavras = texto.split(/\s+/).filter(Boolean).length;
    if (palavras > 130) problemas.push({ onde: "", problema: `${palavras} palavras — e-mail frio que é lido tem de 50 a 120.` });
  }
  if (canal === "linkedin_nota") {
    if (texto.length > 200) problemas.push({ onde: "", problema: `${texto.length} caracteres — nota de convite até 200, sem vender.` });
    if (URL.test(texto)) problemas.push({ onde: "", problema: "Link na nota do convite." });
  }
  if (canal === "linkedin" && texto.length > 500) problemas.push({ onde: "", problema: `${texto.length} caracteres — até 500.` });
  return problemas.map((p) => p.problema);
}

/**
 * Lista o que precisa ser reescrito. Limites por canal: WhatsApp e LinkedIn
 * são conversa (curto, uma ideia, uma pergunta); e-mail frio que performa
 * hoje fica entre 50 e 120 palavras, com assunto curto e sem cara de
 * campanha.
 */
export function revisarCopy(m: MensagensPlano, canais: string[], variaveis: string[]): ProblemaCopy[] {
  const permitidas = new Set(variaveis);
  const problemas: ProblemaCopy[] = [];

  if (canais.includes("whatsapp")) {
    if (m.whatsapp.length < 2 || m.whatsapp.length > 4) problemas.push({ onde: "WhatsApp", problema: `Cadência com ${m.whatsapp.length} mensagens — use 3 (mínimo 2, máximo 4).` });
    m.whatsapp.forEach((e, i) => {
      const onde = `WhatsApp ${i + 1}`;
      checarTexto(onde, e.texto, permitidas, problemas);
      const limite = i === 0 ? 420 : 280;
      if (e.texto.length > limite) problemas.push({ onde, problema: `${e.texto.length} caracteres — no WhatsApp, até ${limite}.` });
      if (i === 0 && URL.test(e.texto)) problemas.push({ onde, problema: "Link na primeira mensagem derruba a entrega e a resposta — deixe o link pra depois que ele responder." });
      // "Oi, tudo bem?" é cumprimento, não pergunta de fechamento.
      const semCumprimento = e.texto.replace(/tudo (bem|certo|bom|joia|jóia)\s*\?/gi, "");
      if ((semCumprimento.match(/\?/g)?.length ?? 0) > 1) problemas.push({ onde, problema: "Mais de uma pergunta — faça uma só." });
    });
  }

  if (canais.includes("email")) {
    if (m.email.length < 3 || m.email.length > 5) problemas.push({ onde: "E-mail", problema: `Cadência com ${m.email.length} e-mails — use 4 (mínimo 3, máximo 5).` });
    m.email.forEach((e, i) => {
      const onde = `E-mail ${i + 1}`;
      checarTexto(`${onde} (assunto)`, e.assunto, permitidas, problemas);
      checarTexto(onde, e.corpo, permitidas, problemas);
      if (e.assunto.length > 50) problemas.push({ onde, problema: `Assunto com ${e.assunto.length} caracteres — até 50, de preferência 2 a 5 palavras.` });
      if (EMOJI.test(e.assunto)) problemas.push({ onde, problema: "Emoji no assunto tem cara de campanha de marketing." });
      const palavras = e.corpo.split(/\s+/).filter(Boolean).length;
      if (palavras > 130) problemas.push({ onde, problema: `${palavras} palavras — e-mail frio que é lido tem de 50 a 120.` });
    });
  }

  if (canais.includes("linkedin")) {
    if (m.linkedinNota) {
      checarTexto("LinkedIn (nota)", m.linkedinNota, permitidas, problemas);
      if (m.linkedinNota.length > 200) problemas.push({ onde: "LinkedIn (nota)", problema: `${m.linkedinNota.length} caracteres — nota de convite até 200, sem vender.` });
      if (URL.test(m.linkedinNota)) problemas.push({ onde: "LinkedIn (nota)", problema: "Link na nota do convite." });
    }
    if (m.linkedinMensagens.length < 2 || m.linkedinMensagens.length > 3) {
      problemas.push({ onde: "LinkedIn", problema: `${m.linkedinMensagens.length} mensagens depois do aceite — use 2 ou 3.` });
    }
    m.linkedinMensagens.forEach((e, i) => {
      checarTexto(`LinkedIn ${i + 1}`, e.texto, permitidas, problemas);
      if (e.texto.length > 500) problemas.push({ onde: `LinkedIn ${i + 1}`, problema: `${e.texto.length} caracteres — até 500.` });
    });
  }

  if (m.roteiroDm) checarTexto("Roteiro", m.roteiroDm, permitidas, problemas);

  const ab = m.testeAB;
  if (ab?.whatsappAbertura && canais.includes("whatsapp")) {
    checarTexto("WhatsApp 1 (versão B)", ab.whatsappAbertura, permitidas, problemas);
    if (ab.whatsappAbertura.length > 420) problemas.push({ onde: "WhatsApp 1 (versão B)", problema: `${ab.whatsappAbertura.length} caracteres — até 420.` });
    if (URL.test(ab.whatsappAbertura)) problemas.push({ onde: "WhatsApp 1 (versão B)", problema: "Link na primeira mensagem." });
  }
  if (ab?.emailAssunto && canais.includes("email")) {
    checarTexto("E-mail 1 (assunto B)", ab.emailAssunto, permitidas, problemas);
    if (ab.emailAssunto.length > 50) problemas.push({ onde: "E-mail 1 (assunto B)", problema: `Assunto com ${ab.emailAssunto.length} caracteres — até 50.` });
  }
  if (ab?.linkedinNota && canais.includes("linkedin")) {
    checarTexto("LinkedIn (nota B)", ab.linkedinNota, permitidas, problemas);
    if (ab.linkedinNota.length > 200) problemas.push({ onde: "LinkedIn (nota B)", problema: `${ab.linkedinNota.length} caracteres — nota de convite até 200.` });
  }
  return problemas;
}
