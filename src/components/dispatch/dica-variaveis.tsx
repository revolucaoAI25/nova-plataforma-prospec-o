"use client";

import { useState } from "react";
import { Check, Eye, Plus, RefreshCw } from "lucide-react";
import { renderizarMensagem } from "@/lib/mensagem";
import { Collapsible } from "@/components/ui/collapsible";
import { TODOS_OS_GRUPOS } from "@/components/flows/lead-field-reference";

/** Lead de exemplo da prévia quando a campanha ainda não tem ninguém inscrito (como a base de CNPJ entrega). */
const LEAD_EXEMPLO: Record<string, unknown> = {
  nome: "CLINICA ODONTOLOGICA SORRISO LTDA",
  socio_principal: "MARIA APARECIDA DA SILVA",
  municipio: "SAO PAULO",
  uf: "SP",
  telefone: "11999990000",
};

/**
 * Insere `token` onde está o cursor do campo (ou no fim), com espaço em volta
 * quando precisa, e devolve o texto novo. O cursor vai para depois do token.
 */
export function inserirNoCursor(campo: HTMLTextAreaElement | HTMLInputElement | null, valor: string, token: string): string {
  const inicio = campo?.selectionStart ?? valor.length;
  const fim = campo?.selectionEnd ?? valor.length;
  const antes = valor.slice(0, inicio);
  const depois = valor.slice(fim);
  const pre = antes && !/\s$/.test(antes) ? " " : "";
  const pos = depois && !/^[\s,.!?;:]/.test(depois) ? " " : "";
  const novo = `${antes}${pre}${token}${pos}${depois}`;
  if (campo) {
    const cursor = antes.length + pre.length + token.length;
    requestAnimationFrame(() => {
      campo.focus();
      campo.setSelectionRange(cursor, cursor);
    });
  }
  return novo;
}

function Chip({ chave, titulo, onInserir }: { chave: string; titulo: string; onInserir?: (token: string) => void }) {
  const [feito, setFeito] = useState(false);
  const token = `{{${chave}}}`;
  return (
    <button
      type="button"
      title={onInserir ? `${titulo} (clique para inserir no texto)` : `${titulo} (clique para copiar)`}
      onClick={() => {
        if (onInserir) onInserir(token);
        else void navigator.clipboard?.writeText(token);
        setFeito(true);
        setTimeout(() => setFeito(false), 1000);
      }}
      className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-1.5 py-0.5 font-mono text-[11px] text-foreground transition-colors hover:border-primary/50 hover:bg-accent"
    >
      {feito ? <Check className="h-3 w-3 text-primary" /> : <Plus className="h-3 w-3 text-muted-foreground" />}
      {token}
    </button>
  );
}

/**
 * Variáveis dos editores de cadência (WhatsApp, e-mail, LinkedIn): as
 * prontas sempre à vista, a lista completa (por origem do dado) num
 * clique, e a prévia de como a mensagem chega — com os leads inscritos na
 * campanha (`leads`) ou um exemplo. Com `onInserir`, clicar numa variável a
 * coloca no texto; sem, copia.
 */
export function DicaVariaveis({
  texto,
  leads = [],
  onInserir,
}: {
  /** Mantido por compatibilidade: a lista completa já mostra todos os campos. */
  extras?: string[];
  texto?: string;
  leads?: unknown[];
  onInserir?: (token: string) => void;
}) {
  const [indice, setIndice] = useState(0);
  const codigo = (t: string) => <code className="rounded bg-secondary px-1 font-mono text-[11px] text-foreground">{t}</code>;
  const reais = leads.filter((l): l is Record<string, unknown> => Boolean(l) && typeof l === "object");
  const lead = reais.length ? reais[indice % reais.length] : LEAD_EXEMPLO;
  const temVariavel = Boolean(texto && /\{\{/.test(texto));
  const [prontos, ...outros] = TODOS_OS_GRUPOS;
  return (
    <div className="flex flex-col gap-2 text-xs text-muted-foreground">
      <div className="flex flex-wrap items-center gap-1.5">
        <span>{onInserir ? "Inserir:" : "Variáveis:"}</span>
        {prontos.campos.map((c) => <Chip key={c.chave} chave={c.chave} titulo={c.label} onInserir={onInserir} />)}
      </div>
      <Collapsible
        className="rounded-lg border border-dashed border-border bg-secondary/20 p-2.5"
        trigger={<span className="text-xs font-semibold text-foreground">Ver todas as variáveis e como usar</span>}
      >
        <div className="flex flex-col gap-2.5 pt-2.5">
          <p className="leading-snug">
            Cada lead recebe a mensagem com os próprios dados. Um campo só vem preenchido se a origem do lead trouxe o dado (ex.: o
            celular do sócio só existe depois de buscar o sócio). Se o dado faltar, a variável some e a frase se ajeita
            (&quot;Oi {"{{primeiro_nome}}"}, tudo bem?&quot; vira &quot;Oi, tudo bem?&quot;). Para usar outra palavra quando faltar, ponha uma barra:{" "}
            {codigo("{{empresa|sua empresa}}")}.
          </p>
          <p className="leading-snug">
            {codigo("{{primeiro_nome}}")}, {codigo("{{empresa}}")} e {codigo("{{cidade}}")} são as melhores para abrir a conversa: já
            vêm arrumadas (sem LTDA, sem caixa alta).
          </p>
          {outros.map((g) => (
            <div key={g.grupo} className="flex flex-col gap-1.5">
              <p className="text-[11px] font-medium text-foreground">{g.grupo}</p>
              <div className="flex flex-wrap gap-1.5">
                {g.campos.map((c) => <Chip key={c.chave} chave={c.chave} titulo={c.label} onInserir={onInserir} />)}
              </div>
            </div>
          ))}
          <p className="leading-snug">
            Lead vindo de planilha: cada coluna vira uma variável com o nome do cabeçalho. Para funcionar, o cabeçalho precisa ser
            sem espaço nem acento (ex.: a coluna &quot;responsavel&quot; vira {codigo("{{responsavel}}")}).
          </p>
        </div>
      </Collapsible>
      {temVariavel && (
        <div className="flex flex-col gap-1 rounded-lg border border-border bg-secondary/40 p-2.5">
          <span className="flex items-center gap-1.5 font-medium text-foreground">
            <Eye className="h-3.5 w-3.5" /> Prévia {reais.length ? `com um lead da campanha (${(indice % reais.length) + 1} de ${reais.length})` : "com um lead de exemplo"}
            {reais.length > 1 && (
              <button
                type="button"
                onClick={() => setIndice((i) => i + 1)}
                className="ml-auto inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-primary hover:bg-secondary"
              >
                <RefreshCw className="h-3 w-3" /> outro lead
              </button>
            )}
          </span>
          <p className="whitespace-pre-line text-sm text-foreground">{renderizarMensagem(texto ?? "", lead) || "—"}</p>
        </div>
      )}
    </div>
  );
}
