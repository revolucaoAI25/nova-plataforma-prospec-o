"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Check, ExternalLink, Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { FlowNodeTipo } from "@/lib/database.types";
import { camposDisponiveis, CAMPOS_SEMPRE } from "./lead-field-reference";

const CAMPANHA_DO_NO: Partial<Record<FlowNodeTipo, { api: string; pagina: string }>> = {
  disparo_whatsapp: { api: "/api/dispatch/campaigns", pagina: "/disparo/campanhas" },
  disparo_email: { api: "/api/email-dispatch/campaigns", pagina: "/disparo-email/campanhas" },
  disparo_linkedin: { api: "/api/linkedin-dispatch/campaigns", pagina: "/disparo-linkedin/campanhas" },
};

interface Campanha {
  nome?: string;
  status?: string;
  limite_novos_por_dia?: number | null;
  janela_inicio?: string | null;
  janela_fim?: string | null;
  janela_dias?: number[] | null;
}

type Etapa = Record<string, unknown> & { ordem?: number; atraso_horas?: number };

const AUTOMATICO = "__auto__";
const DIAS = ["", "seg", "ter", "qua", "qui", "sex", "sáb", "dom"];
const TOKEN = /\{\{\s*([a-zA-Z0-9_]+)\s*(\|[^}]*)?\}\}/g;

/** Texto de cada etapa como o lead lê (template oficial: {{1}}, {{2}} trocados pelo que foi escolhido na etapa). */
function textosDaEtapa(e: Etapa): { titulo?: string; texto: string }[] {
  const s = (v: unknown) => (typeof v === "string" ? v : "");
  if ("corpo_mensagem" in e) {
    const params = Array.isArray(e.parametros_template) ? (e.parametros_template as string[]) : [];
    const corpo = e.template_id ? s(e.corpo_mensagem).replace(/\{\{\s*(\d+)\s*\}\}/g, (m, n) => params[Number(n) - 1] || m) : s(e.corpo_mensagem);
    return [{ texto: corpo }, ...(s(e.corpo_mensagem_b) ? [{ titulo: "Versão B", texto: s(e.corpo_mensagem_b) }] : [])];
  }
  if ("assunto" in e) return [{ titulo: `Assunto: ${s(e.assunto)}`, texto: s(e.corpo) }];
  if (e.tipo === "convite") return [{ titulo: "Convite", texto: s(e.nota) || "(convite sem nota)" }];
  return [{ texto: s(e.corpo) }];
}

function quando(e: Etapa, i: number): string {
  const h = Number(e.atraso_horas || 0);
  if (i === 0) return h ? `${h} h depois de inscrito` : "assim que inscrito";
  if (!h) return "logo depois da anterior";
  return h % 24 === 0 ? `${h / 24} dia(s) depois, se não responder` : `${h} h depois, se não responder`;
}

/** Texto com as variáveis destacadas. */
function ComVariaveis({ texto }: { texto: string }) {
  const partes = texto.split(/(\{\{[^}]*\}\})/g);
  return (
    <p className="whitespace-pre-line text-xs text-foreground">
      {partes.map((p, i) =>
        /^\{\{.*\}\}$/.test(p) ? <span key={i} className="rounded bg-accent px-1 font-mono text-[11px] text-accent-foreground">{p}</span> : p,
      )}
    </p>
  );
}

/**
 * O que o módulo de disparo faz com a campanha escolhida, sem sair da
 * automação: status (e o que ele significa), ritmo, as mensagens com as
 * variáveis destacadas e, para cada variável, de onde vem o dado — com a
 * opção de apontar outro campo do lead (`mapeamento`), aplicada só aos leads
 * que esta automação inscreve.
 */
export function ResumoCampanha({
  tipo, campaignId, tipos, viaRamo, mapeamento, onMapear,
}: {
  tipo: FlowNodeTipo;
  campaignId: string;
  tipos: FlowNodeTipo[];
  viaRamo: boolean;
  mapeamento: Record<string, string>;
  onMapear: (m: Record<string, string>) => void;
}) {
  const destino = CAMPANHA_DO_NO[tipo];
  const [dados, setDados] = useState<{ campanha: Campanha; etapas: Etapa[] } | null>(null);
  const [ativando, setAtivando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!destino || !campaignId) return;
    let vivo = true;
    fetch(`${destino.api}/${campaignId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => vivo && setDados({ campanha: (d?.campanha ?? {}) as Campanha, etapas: Array.isArray(d?.etapas) ? d.etapas : [] }))
      .catch(() => vivo && setDados({ campanha: {}, etapas: [] }));
    return () => { vivo = false; };
  }, [destino, campaignId]);

  if (!destino) return null;
  if (!dados) return <p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando a campanha…</p>;

  const { campanha, etapas } = dados;
  const link = (
    <a href={`${destino.pagina}/${campaignId}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
      abrir campanha <ExternalLink className="h-3 w-3" />
    </a>
  );

  async function ativar() {
    setAtivando(true);
    setErro(null);
    const resp = await fetch(`${destino!.api}/${campaignId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "ativa" }),
    }).catch(() => null);
    const j = await resp?.json().catch(() => null);
    setAtivando(false);
    if (!resp?.ok) return setErro(j?.error ?? "Não foi possível ativar a campanha. Abra a campanha para conferir.");
    setDados((d) => (d ? { ...d, campanha: { ...d.campanha, status: "ativa" } } : d));
  }

  const status = campanha.status ?? "";
  const ativa = status === "ativa";

  // Variáveis usadas nas mensagens e se o dado chega até este ponto da automação.
  const { grupos, dePlanilha } = camposDisponiveis(tipos, viaRamo);
  const opcoes = grupos.flatMap((g) => g.campos).filter((c, i, todos) => todos.findIndex((x) => x.chave === c.chave) === i);
  const conhecidos = new Set([...CAMPOS_SEMPRE, ...opcoes.map((c) => c.chave)]);
  const usadas = new Map<string, boolean>(); // variável → tem texto padrão
  for (const m of JSON.stringify(etapas).matchAll(TOKEN)) {
    if (/^\d+$/.test(m[1])) continue;
    usadas.set(m[1], (usadas.get(m[1]) ?? false) || Boolean(m[2]));
  }

  const ritmo = [
    campanha.limite_novos_por_dia ? `até ${campanha.limite_novos_por_dia} leads novos por dia` : null,
    campanha.janela_inicio && campanha.janela_fim ? `das ${campanha.janela_inicio.slice(0, 5)} às ${campanha.janela_fim.slice(0, 5)}` : null,
    campanha.janela_dias?.length && campanha.janela_dias.length < 7 ? campanha.janela_dias.map((d) => DIAS[d]).join(", ") : null,
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-secondary/20 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 truncate text-xs font-semibold text-foreground">{campanha.nome ?? "Campanha"}</p>
        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", ativa ? "bg-success/15 text-success" : "bg-amber-500/15 text-amber-700 dark:text-amber-400")}>
          {ativa ? "Ativa" : status === "pausada" ? "Pausada" : status === "concluida" ? "Concluída" : "Rascunho"}
        </span>
      </div>

      {ativa ? (
        <p className="text-[11px] leading-snug text-muted-foreground">
          Quem esta automação inscrever começa a receber as mensagens abaixo{ritmo.length ? `, ${ritmo.join(", ")}` : ""}. {link}
        </p>
      ) : (
        <div className="flex flex-col gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-2.5 text-[11px] leading-snug text-foreground">
          <span className="flex items-start gap-1.5">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
            {status === "concluida"
              ? "A campanha está concluída: os leads entram, mas ninguém recebe mensagem."
              : "Com a campanha parada, a automação inscreve os leads, mas ninguém recebe mensagem até você ativá-la."}
          </span>
          {status !== "concluida" && (
            <Button type="button" size="sm" variant="outline" className="self-start" onClick={ativar} disabled={ativando}>
              {ativando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />} Ativar campanha
            </Button>
          )}
          {erro && <p className="text-destructive">{erro}</p>}
        </div>
      )}

      {etapas.length === 0 ? (
        <p className="flex items-start gap-1.5 rounded-lg border border-destructive/40 bg-destructive-soft p-2.5 text-xs text-destructive">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>Esta campanha ainda não tem nenhuma mensagem: ninguém será inscrito. {link}</span>
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-semibold text-foreground">Mensagens que o lead recebe</p>
          {etapas.map((e, i) => (
            <div key={String(e.id ?? i)} className="flex flex-col gap-1 rounded-lg border border-border bg-card p-2.5">
              <span className="text-[11px] text-muted-foreground">{i + 1}ª · {quando(e, i)}</span>
              {textosDaEtapa(e).map((t, j) => (
                <div key={j} className="flex flex-col gap-0.5">
                  {t.titulo && <span className="text-[11px] font-medium text-muted-foreground">{t.titulo}</span>}
                  <ComVariaveis texto={t.texto} />
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {usadas.size > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-semibold text-foreground">De onde vem cada variável</p>
          {[...usadas.entries()].map(([variavel, temPadrao]) => {
            const mapeada = mapeamento[variavel];
            const chega = Boolean(mapeada) || conhecidos.has(variavel) || dePlanilha;
            return (
              <div key={variavel} className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-[11px]">
                  <code className="rounded bg-accent px-1 font-mono text-accent-foreground">{`{{${variavel}}}`}</code>
                  {chega ? (
                    <span className="flex items-center gap-1 text-muted-foreground"><Check className="h-3 w-3 text-primary" /> {mapeada ? "vem do campo escolhido" : "chega até aqui"}</span>
                  ) : (
                    <span className="flex items-center gap-1 text-amber-700 dark:text-amber-400">
                      <AlertTriangle className="h-3 w-3" /> {temPadrao ? "não chega: vai o texto padrão" : "não chega: some da frase"}
                    </span>
                  )}
                </div>
                {dePlanilha ? (
                  <Input
                    value={mapeada ?? ""}
                    onChange={(ev) => onMapear({ ...mapeamento, [variavel]: ev.target.value })}
                    placeholder="Automático, ou o nome da coluna da planilha"
                    className="h-9 text-xs"
                  />
                ) : (
                  <Select
                    value={mapeada || AUTOMATICO}
                    onValueChange={(v) => {
                      if (!v) return;
                      const novo = { ...mapeamento };
                      if (v === AUTOMATICO) delete novo[variavel];
                      else novo[variavel] = v;
                      onMapear(novo);
                    }}
                  >
                    <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={AUTOMATICO}>Automático (o próprio {variavel})</SelectItem>
                      {opcoes.filter((c) => c.chave !== variavel).map((c) => (
                        <SelectItem key={c.chave} value={c.chave}>Usar: {c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            );
          })}
          <p className="text-[11px] leading-snug text-muted-foreground">
            A troca vale só para os leads que esta automação inscreve; a mensagem da campanha não muda.
          </p>
        </div>
      )}

      <p className="border-t border-border pt-2 text-[11px] leading-snug text-muted-foreground">
        Como funciona: este módulo só inscreve os leads na campanha. O texto, o ritmo, o horário e o limite por dia são os da
        campanha e valem para todos os leads dela, venham daqui ou da tela da campanha. O módulo &quot;Limitar lote&quot; só define
        quantos leads esta automação inscreve por vez. Quem já está na campanha não é inscrito de novo.
      </p>
    </div>
  );
}
