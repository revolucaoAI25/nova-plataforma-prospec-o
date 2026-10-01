/**
 * Dica de variáveis dos editores de cadência (WhatsApp, e-mail, LinkedIn).
 * As três primeiras são calculadas na hora do envio (src/lib/mensagem.ts):
 * nome sem LTDA nem caixa alta, primeiro nome do sócio/pessoa, cidade.
 */
export function DicaVariaveis({ extras = [] }: { extras?: string[] }) {
  const codigo = (t: string) => <code className="rounded bg-secondary px-1 font-mono text-[11px] text-foreground">{t}</code>;
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
    </div>
  );
}
