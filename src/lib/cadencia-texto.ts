// "Escrever a cadência inteira": o usuário escreve todas as mensagens num
// texto só, separadas por uma linha de espera, e a plataforma vira isso em
// etapas. É como se escreve uma sequência no papel — vê o tom do começo ao
// fim, em vez de montar etapa por etapa num formulário.
//
//   Oi {{primeiro_nome}}, tudo bem? ...
//   --- 2 dias
//   Conseguiu pensar no que te falei? ...
//   --- 4 dias
//   Vou encerrar por aqui ...
//
// Separador: linha começando com "---", seguida opcionalmente da espera
// ("2 dias", "3d", "48h", "12 horas"); sem número, vale 2 dias. Dentro de
// um bloco:
//   - e-mail: 1ª linha "Assunto: ..." (follow-up sem assunto vira "Re: <assunto do 1º>");
//   - LinkedIn: bloco que começa com "Convite:" vira pedido de conexão com nota;
//   - "B: ..." numa linha própria inicia a variante B daquele bloco (teste A/B);
//     no e-mail, "Assunto B: ..." define o assunto B.

export type CanalCadencia = "whatsapp" | "email" | "linkedin";

export interface EtapaEscrita {
  atrasoHoras: number;
  texto: string;
  textoB: string | null;
  assunto?: string;
  assuntoB?: string | null;
  tipo?: "convite" | "mensagem";
}

const SEPARADOR = /^\s*-{3,}\s*(.*)$/;
const PADRAO_ESPERA_HORAS = 48;

function lerEspera(resto: string): number {
  const m = resto.trim().toLowerCase().match(/(\d+(?:[.,]\d+)?)\s*(d|dia|dias|h|hora|horas)?\b/);
  if (!m) return PADRAO_ESPERA_HORAS;
  const n = Number(m[1].replace(",", "."));
  const unidade = m[2] || "d";
  return Math.max(0, Math.round(unidade.startsWith("h") ? n : n * 24));
}

function separarVariante(linhas: string[]): { a: string; b: string | null } {
  const i = linhas.findIndex((l) => /^\s*B\s*:/.test(l));
  if (i < 0) return { a: linhas.join("\n").trim(), b: null };
  const b = [linhas[i].replace(/^\s*B\s*:\s*/, ""), ...linhas.slice(i + 1)].join("\n").trim();
  return { a: linhas.slice(0, i).join("\n").trim(), b: b || null };
}

export function interpretarCadencia(texto: string, canal: CanalCadencia): { etapas: EtapaEscrita[]; erros: string[] } {
  const blocos: Array<{ espera: number; linhas: string[] }> = [{ espera: 0, linhas: [] }];
  for (const linha of texto.replace(/\r\n/g, "\n").split("\n")) {
    const sep = linha.match(SEPARADOR);
    if (sep) blocos.push({ espera: lerEspera(sep[1]), linhas: [] });
    else blocos[blocos.length - 1].linhas.push(linha);
  }

  const erros: string[] = [];
  const etapas: EtapaEscrita[] = [];
  let primeiroAssunto = "";

  blocos.forEach((bloco, i) => {
    let linhas = [...bloco.linhas];
    while (linhas.length && !linhas[0].trim()) linhas.shift();
    if (!linhas.join("").trim()) {
      if (i > 0 || blocos.length === 1) erros.push(`Mensagem ${etapas.length + 1} está vazia.`);
      return;
    }

    const etapa: EtapaEscrita = { atrasoHoras: bloco.espera, texto: "", textoB: null };

    if (canal === "email") {
      let assunto = "";
      let assuntoB: string | null = null;
      while (linhas.length && /^\s*assunto( b)?\s*:/i.test(linhas[0])) {
        const l = linhas.shift()!;
        if (/^\s*assunto b\s*:/i.test(l)) assuntoB = l.replace(/^\s*assunto b\s*:\s*/i, "").trim() || null;
        else assunto = l.replace(/^\s*assunto\s*:\s*/i, "").trim();
      }
      if (!assunto) {
        if (!primeiroAssunto) erros.push(`E-mail ${etapas.length + 1}: comece com uma linha "Assunto: …".`);
        assunto = primeiroAssunto ? `Re: ${primeiroAssunto.replace(/^re:\s*/i, "")}` : "";
      }
      if (!primeiroAssunto) primeiroAssunto = assunto;
      etapa.assunto = assunto;
      etapa.assuntoB = assuntoB;
    }

    if (canal === "linkedin") {
      if (/^\s*convite\s*:/i.test(linhas[0])) {
        etapa.tipo = "convite";
        linhas = [linhas[0].replace(/^\s*convite\s*:\s*/i, ""), ...linhas.slice(1)];
      } else {
        etapa.tipo = "mensagem";
      }
    }

    const { a, b } = separarVariante(linhas);
    etapa.texto = a;
    etapa.textoB = b;
    if (!a && !(canal === "linkedin" && etapa.tipo === "convite")) erros.push(`Mensagem ${etapas.length + 1} está vazia.`);
    if (canal === "linkedin" && etapa.tipo === "convite") {
      if (a.length > 300) erros.push(`Nota do convite com ${a.length} caracteres — o LinkedIn aceita até 300.`);
      if (b && b.length > 300) erros.push(`Nota B do convite com ${b.length} caracteres — o LinkedIn aceita até 300.`);
    }
    etapas.push(etapa);
  });

  if (canal === "linkedin" && etapas.some((e, i) => e.tipo === "convite" && i > 0)) {
    erros.push("O convite precisa ser a primeira etapa — mensagem só sai depois que a pessoa aceita.");
  }
  return { etapas, erros };
}

/** "Dia 0", "Dia 2", "Dia 5": quando cada etapa sai, contando da inscrição. */
export function diasAcumulados(etapas: Array<{ atrasoHoras: number }>): number[] {
  let total = 0;
  return etapas.map((e) => {
    total += e.atrasoHoras;
    return Math.round((total / 24) * 10) / 10;
  });
}

/** Texto de volta a partir das etapas já criadas (pra editar a cadência existente no mesmo formato). */
export function cadenciaParaTexto(
  canal: CanalCadencia,
  etapas: Array<{ atrasoHoras: number; texto: string; textoB?: string | null; assunto?: string; assuntoB?: string | null; tipo?: string }>,
): string {
  return etapas.map((e, i) => {
    const partes: string[] = [];
    if (i > 0) {
      const h = e.atrasoHoras;
      partes.push(h % 24 === 0 ? `--- ${h / 24} dia${h / 24 === 1 ? "" : "s"}` : `--- ${h}h`);
    }
    if (canal === "email") {
      partes.push(`Assunto: ${e.assunto || ""}`);
      if (e.assuntoB) partes.push(`Assunto B: ${e.assuntoB}`);
    }
    partes.push(canal === "linkedin" && e.tipo === "convite" ? `Convite: ${e.texto}` : e.texto);
    if (e.textoB) partes.push(`B: ${e.textoB}`);
    return partes.join("\n");
  }).join("\n");
}
