"use client";

import { useState } from "react";
import { Eye, RefreshCw } from "lucide-react";
import { renderizarMensagem } from "@/lib/mensagem";

/** Lead de exemplo da prévia quando a campanha ainda não tem ninguém inscrito (como a base de CNPJ entrega). */
const LEAD_EXEMPLO: Record<string, unknown> = {
  nome: "CLINICA ODONTOLOGICA SORRISO LTDA",
  socio_principal: "MARIA APARECIDA DA SILVA",
  municipio: "SAO PAULO",
  uf: "SP",
  telefone: "11999990000",
};

/**
 * Dica de variáveis dos editores de cadência (WhatsApp, e-mail, LinkedIn).
 * As três primeiras são calculadas na hora do envio (src/lib/mensagem.ts):
 * nome sem LTDA nem caixa alta, primeiro nome do sócio/pessoa, cidade.
 * Com `texto`, mostra a prévia de como a mensagem chega — com os leads
 * inscritos na campanha (`leads`), ou um exemplo quando não há nenhum.
 */
export function DicaVariaveis({ extras = [], texto, leads = [] }: { extras?: string[]; texto?: string; leads?: unknown[] }) {
  const [indice, setIndice] = useState(0);
  const codigo = (t: string) => <code className="rounded bg-secondary px-1 font-mono text-[11px] text-foreground">{t}</code>;
  const reais = leads.filter((l): l is Record<string, unknown> => Boolean(l) && typeof l === "object");
  const lead = reais.length ? reais[indice % reais.length] : LEAD_EXEMPLO;
  const temVariavel = Boolean(texto && /\{\{/.test(texto));
  return (
    <div className="flex flex-col gap-1 text-xs text-muted-foreground">
      <p>
        Personalização pronta: {codigo("{{empresa}}")}, {codigo("{{primeiro_nome}}")}, {codigo("{{cidade}}")}
        {extras.length > 0 && <> · também {extras.map((e, i) => <span key={e}>{i > 0 && ", "}{codigo(`{{${e}}}`)}</span>)}</>}.
      </p>
      <p>
        Se o dado faltar, a variável some e a frase se ajeita (&quot;Oi {"{{primeiro_nome}}"}, tudo bem?&quot; vira &quot;Oi, tudo bem?&quot;).
        Pra trocar por outra palavra, use barra: {codigo("{{empresa|sua empresa}}")}.
      </p>
      {temVariavel && (
        <div className="mt-1 flex flex-col gap-1 rounded-lg border border-border bg-secondary/40 p-2.5">
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
