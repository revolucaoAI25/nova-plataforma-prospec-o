"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, FlaskConical, Gauge, Loader2, PenLine, Save } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { interpretarCadencia, diasAcumulados, cadenciaParaTexto, type CanalCadencia, type EtapaEscrita } from "@/lib/cadencia-texto";
import { revisarMensagem } from "@/lib/onboarding/copy";

// Peças compartilhadas pelos editores de campanha dos três canais:
// ritmo de envio (novos/dia, janela, dias, intervalo), variante B por etapa
// e o modo "escrever a cadência inteira".

const DIAS = [
  { n: 1, curto: "Seg" }, { n: 2, curto: "Ter" }, { n: 3, curto: "Qua" }, { n: 4, curto: "Qui" },
  { n: 5, curto: "Sex" }, { n: 6, curto: "Sáb" }, { n: 7, curto: "Dom" },
];

export interface RitmoCampanha {
  limite_novos_por_dia: number | null;
  janela_inicio: string | null;
  janela_fim: string | null;
  janela_dias: number[] | null;
  intervalo_min_seg: number;
  intervalo_max_seg: number;
}

function hhmm(v: string | null, padrao: string) {
  return (v || padrao).slice(0, 5);
}

function duracao(seg: number) {
  if (seg < 120) return `${seg}s`;
  const min = Math.round(seg / 60);
  return min < 120 ? `${min} min` : `${Math.round((min / 60) * 10) / 10}h`;
}

/**
 * Card "Ritmo de envio". O limite de novos/dia é o freio que deixa jogar
 * uma lista grande numa campanha sem queimar o número/domínio/conta: quem já
 * está na cadência continua recebendo os follow-ups normalmente.
 */
export function RitmoEnvioCard({
  endpoint, campanha, pisoIntervaloSeg, novosNaFila, sugestaoLimite, canalLabel,
}: {
  endpoint: string;
  campanha: RitmoCampanha;
  pisoIntervaloSeg: number;
  /** Alvos que ainda não receberam o 1º toque — pra estimar quanto tempo a fila leva. */
  novosNaFila: number;
  sugestaoLimite: string;
  canalLabel: string;
}) {
  const [limite, setLimite] = useState(campanha.limite_novos_por_dia ? String(campanha.limite_novos_por_dia) : "");
  const [inicio, setInicio] = useState(hhmm(campanha.janela_inicio, "08:00"));
  const [fim, setFim] = useState(hhmm(campanha.janela_fim, "19:00"));
  const [dias, setDias] = useState<number[]>(campanha.janela_dias ?? [1, 2, 3, 4, 5]);
  const [minSeg, setMinSeg] = useState(campanha.intervalo_min_seg);
  const [maxSeg, setMaxSeg] = useState(campanha.intervalo_max_seg);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<{ ok: boolean; msg: string } | null>(null);

  const limiteNum = limite.trim() ? Math.max(1, Math.floor(Number(limite))) : null;
  const diasUteisFila = limiteNum && novosNaFila ? Math.ceil(novosNaFila / limiteNum) : null;
  const semanasFila = diasUteisFila && dias.length ? Math.ceil((diasUteisFila / dias.length) * 10) / 10 : null;

  function alternarDia(n: number) {
    setDias((prev) => (prev.includes(n) ? prev.filter((d) => d !== n) : [...prev, n].sort()));
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setAviso(null);
    if (limite.trim() && (!Number.isFinite(Number(limite)) || Number(limite) < 1)) {
      setAviso({ ok: false, msg: "Limite de novos por dia precisa ser um número a partir de 1 (ou vazio pra sem limite)." });
      return;
    }
    setSalvando(true);
    const resp = await fetch(endpoint, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        limiteNovosPorDia: limiteNum, janelaInicio: inicio, janelaFim: fim, janelaDias: dias,
        intervaloMinSeg: minSeg, intervaloMaxSeg: maxSeg,
      }),
    }).catch(() => null);
    const data = await resp?.json().catch(() => ({}));
    setSalvando(false);
    setAviso(resp?.ok ? { ok: true, msg: "Ritmo salvo. Vale a partir do próximo envio." } : { ok: false, msg: data?.error || "Não foi possível salvar o ritmo." });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><Gauge className="h-4 w-4 text-primary" /> Ritmo de envio</CardTitle>
        <CardDescription>
          Quantos leads novos a campanha aborda por dia e em que horário. Follow-up de quem já recebeu a 1ª mensagem não entra no limite.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={salvar} className="flex flex-col gap-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ritmo-limite">Leads novos por dia</Label>
              <Input
                id="ritmo-limite" type="number" inputMode="numeric" min={1} placeholder="Sem limite"
                value={limite} onChange={(e) => setLimite(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">{sugestaoLimite}</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Horário de envio (Brasília)</Label>
              <div className="flex flex-wrap items-center gap-2">
                <Input aria-label="Início" type="time" value={inicio} onChange={(e) => setInicio(e.target.value)} className="w-[7.5rem]" />
                <span className="text-sm text-muted-foreground">até</span>
                <Input aria-label="Fim" type="time" value={fim} onChange={(e) => setFim(e.target.value)} className="w-[7.5rem]" />
              </div>
              <p className="text-xs text-muted-foreground">Fora desse horário nada sai; o que vencer espera o próximo horário.</p>
            </div>
          </div>

          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1.5 text-sm font-medium text-foreground">Dias da semana</legend>
            <div className="flex flex-wrap gap-2">
              {DIAS.map((d) => {
                const ativo = dias.includes(d.n);
                return (
                  <button
                    key={d.n} type="button" aria-pressed={ativo} onClick={() => alternarDia(d.n)}
                    className={cn(
                      "min-h-10 min-w-12 rounded-lg border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      ativo ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:border-primary/40",
                    )}
                  >
                    {d.curto}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="flex flex-col gap-1.5">
            <Label>Intervalo entre um envio e outro ({canalLabel})</Label>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                aria-label="Mínimo em segundos" type="number" min={pisoIntervaloSeg} value={minSeg}
                onChange={(e) => setMinSeg(Math.max(pisoIntervaloSeg, Number(e.target.value) || pisoIntervaloSeg))} className="w-28"
              />
              <span className="text-sm text-muted-foreground">a</span>
              <Input
                aria-label="Máximo em segundos" type="number" min={pisoIntervaloSeg} value={maxSeg}
                onChange={(e) => setMaxSeg(Math.max(pisoIntervaloSeg, Number(e.target.value) || pisoIntervaloSeg))} className="w-28"
              />
              <span className="text-sm text-muted-foreground">segundos ({duracao(minSeg)} a {duracao(maxSeg)}, sorteado a cada envio)</span>
            </div>
          </div>

          {(diasUteisFila || novosNaFila > 0) && (
            <p className="flex items-start gap-2 rounded-lg bg-secondary/40 p-3 text-sm text-muted-foreground">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              {diasUteisFila
                ? <span>{novosNaFila} lead{novosNaFila === 1 ? "" : "s"} esperando o 1º contato: com {limiteNum}/dia, a fila zera em uns {diasUteisFila} dia{diasUteisFila === 1 ? "" : "s"} de envio{semanasFila && semanasFila >= 1 ? ` (~${semanasFila.toLocaleString("pt-BR")} semana${semanasFila === 1 ? "" : "s"})` : ""}.</span>
                : <span>{novosNaFila} lead{novosNaFila === 1 ? "" : "s"} esperando o 1º contato, sem limite diário: saem todos no ritmo do intervalo, dentro do horário.</span>}
            </p>
          )}

          {aviso && (
            <Alert variant={aviso.ok ? "success" : "destructive"} role={aviso.ok ? "status" : "alert"}>
              <AlertDescription>{aviso.msg}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" disabled={salvando || !dias.length} className="self-start">
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar ritmo
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

/** Avisos de copy inline — o mesmo revisor que corrige as sugestões geradas. */
export function AvisosCopy({ problemas }: { problemas: string[] }) {
  if (!problemas.length) return null;
  return (
    <ul className="flex flex-col gap-0.5 text-xs text-amber" aria-live="polite">
      {problemas.map((p) => (
        <li key={p} className="flex items-start gap-1.5"><AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {p}</li>
      ))}
    </ul>
  );
}

/**
 * Editor da variante B de uma etapa. Metade dos leads (sorteio na inscrição)
 * recebe o texto B; o relatório compara resposta de A e B. Vazio = sem teste.
 */
export function VarianteBEditor({
  endpoint, campos, canal, indice,
}: {
  endpoint: string;
  /** Campos editáveis: chave da API → rótulo, valor atual e se é linha única. */
  campos: Array<{ chave: string; rotulo: string; valor: string | null; linhaUnica?: boolean; max?: number }>;
  canal: "whatsapp" | "email" | "linkedin_nota" | "linkedin";
  indice: number;
}) {
  const temTeste = campos.some((c) => c.valor?.trim());
  const [aberto, setAberto] = useState(false);
  const [valores, setValores] = useState<Record<string, string>>(() => Object.fromEntries(campos.map((c) => [c.chave, c.valor ?? ""])));
  const [salvos, setSalvos] = useState(valores);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const corpoChave = campos.find((c) => !c.linhaUnica)?.chave ?? campos[0].chave;
  const assuntoChave = campos.find((c) => c.linhaUnica)?.chave;
  const problemas = valores[corpoChave]?.trim()
    ? revisarMensagem(canal, valores[corpoChave], indice, assuntoChave ? valores[assuntoChave] : undefined)
    : [];

  async function salvar(limpar = false) {
    setSalvando(true);
    setErro(null);
    const corpo = limpar ? Object.fromEntries(campos.map((c) => [c.chave, null])) : Object.fromEntries(Object.entries(valores).map(([k, v]) => [k, v.trim() || null]));
    const resp = await fetch(endpoint, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) }).catch(() => null);
    setSalvando(false);
    if (!resp?.ok) {
      setErro("Não foi possível salvar a variante B.");
      return;
    }
    const novos = limpar ? Object.fromEntries(campos.map((c) => [c.chave, ""])) : valores;
    setValores(novos);
    setSalvos(novos);
    if (limpar) setAberto(false);
  }

  const ativo = Object.values(salvos).some((v) => v.trim());
  if (!aberto) {
    return (
      <button
        type="button" onClick={() => setAberto(true)}
        className="flex min-h-9 items-center gap-1.5 self-start rounded-md text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <FlaskConical className="h-3.5 w-3.5" /> {ativo || temTeste ? "Teste A/B ativo · editar variante B" : "Testar outra versão (A/B)"}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-primary/30 bg-accent/30 p-3">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground"><FlaskConical className="h-3.5 w-3.5 text-primary" /> Variante B</p>
      <p className="text-xs text-muted-foreground">Metade dos leads recebe esta versão. Mude uma coisa só (abertura, pergunta, assunto) pra saber o que fez diferença.</p>
      {campos.map((c) => (
        <div key={c.chave} className="flex flex-col gap-1">
          <Label className="text-xs">{c.rotulo}</Label>
          {c.linhaUnica ? (
            <Input value={valores[c.chave]} maxLength={c.max} onChange={(e) => setValores((v) => ({ ...v, [c.chave]: e.target.value }))} />
          ) : (
            <Textarea rows={3} value={valores[c.chave]} maxLength={c.max} onChange={(e) => setValores((v) => ({ ...v, [c.chave]: e.target.value }))} />
          )}
        </div>
      ))}
      <AvisosCopy problemas={problemas} />
      {erro && <p className="text-xs text-destructive" role="alert">{erro}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={() => salvar(false)} disabled={salvando}>
          {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar variante B
        </Button>
        {ativo && <Button type="button" size="sm" variant="outline" onClick={() => salvar(true)} disabled={salvando}>Encerrar teste</Button>}
        <Button type="button" size="sm" variant="ghost" onClick={() => setAberto(false)}>Fechar</Button>
      </div>
    </div>
  );
}

const EXEMPLOS: Record<CanalCadencia, string> = {
  whatsapp: "Oi {{primeiro_nome}}, tudo bem? Vi que a {{empresa|sua empresa}} atende em {{cidade|sua região}}. …\nB: (opcional) outra abertura pra testar\n--- 2 dias\nSegunda mensagem…\n--- 3 dias\nÚltima mensagem, encerrando sem pressão…",
  email: "Assunto: pergunta rápida\nAssunto B: (opcional) outro assunto pra testar\nOi {{primeiro_nome}}, …\n--- 3 dias\nRetomando o e-mail anterior…\n--- 4 dias\nAssunto: encerrando por aqui\nÚltimo e-mail…",
  linkedin: "Convite: Oi {{primeiro_nome}}, vi seu trabalho na {{empresa}} e quis me conectar.\n--- 1 dia\nObrigado por aceitar, {{primeiro_nome}}. …\n--- 4 dias\nSegunda mensagem…",
};

/**
 * "Escrever a cadência inteira": um texto só com todas as mensagens,
 * separadas por "--- N dias". Mostra a linha do tempo e os avisos de copy
 * antes de criar as etapas.
 */
export function EscreverCadenciaDialog({
  canal, aberto, onOpenChange, etapasExistentes, onCriar,
}: {
  canal: CanalCadencia;
  aberto: boolean;
  onOpenChange: (v: boolean) => void;
  etapasExistentes: Parameters<typeof cadenciaParaTexto>[1];
  /** Cria as etapas (substituindo as atuais se `substituir`). Devolve mensagem de erro ou null. */
  onCriar: (etapas: EtapaEscrita[], substituir: boolean) => Promise<string | null>;
}) {
  const temExistentes = etapasExistentes.length > 0;
  const [texto, setTexto] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // Ao abrir, começa da cadência atual (ajuste de estado durante a
  // renderização, quando `aberto` muda — o pai é quem abre o diálogo).
  const [abertoAntes, setAbertoAntes] = useState(false);
  if (aberto !== abertoAntes) {
    setAbertoAntes(aberto);
    if (aberto) {
      setTexto(temExistentes ? cadenciaParaTexto(canal, etapasExistentes) : "");
      setErro(null);
    }
  }
  const { etapas, erros: errosBrutos } = useMemo(() => interpretarCadencia(texto, canal), [texto, canal]);
  // Texto em branco não é erro, é só o começo.
  const erros = texto.trim() ? errosBrutos : [];
  const dias = diasAcumulados(etapas);

  async function criar() {
    setSalvando(true);
    setErro(null);
    const falha = await onCriar(etapas, temExistentes);
    setSalvando(false);
    if (falha) setErro(falha);
    else onOpenChange(false);
  }

  const canalRevisao = (e: EtapaEscrita) => (canal === "linkedin" ? (e.tipo === "convite" ? "linkedin_nota" : "linkedin") : canal);

  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><PenLine className="h-5 w-5 text-primary" /> Escrever a cadência inteira</DialogTitle>
          <DialogDescription>
            Escreva todas as mensagens de uma vez, na ordem, separando com uma linha <code className="rounded bg-secondary px-1 font-mono text-xs">--- 2 dias</code> (a espera desde a mensagem anterior).
            {canal === "email" && <> Cada e-mail começa com <code className="rounded bg-secondary px-1 font-mono text-xs">Assunto:</code>; sem assunto, vira resposta do primeiro.</>}
            {canal === "linkedin" && <> A primeira pode ser o pedido de conexão: comece com <code className="rounded bg-secondary px-1 font-mono text-xs">Convite:</code>.</>}
            {" "}Uma linha <code className="rounded bg-secondary px-1 font-mono text-xs">B:</code> abre a variante B do teste A/B.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-[1fr_17rem]">
          <Textarea
            aria-label="Cadência" value={texto} onChange={(e) => setTexto(e.target.value)} rows={16}
            placeholder={EXEMPLOS[canal]} className="font-mono text-[13px] leading-relaxed"
          />
          <ol className="flex flex-col gap-2" aria-label="Linha do tempo">
            {etapas.map((e, i) => {
              const problemas = revisarMensagem(canalRevisao(e), e.texto, i, e.assunto);
              return (
                <li key={i} className="flex flex-col gap-1 rounded-lg border border-border p-2.5">
                  <span className="flex items-center justify-between text-xs font-semibold text-foreground">
                    <span>Dia {dias[i]}{canal === "linkedin" ? ` · ${e.tipo === "convite" ? "convite" : "mensagem"}` : ""}</span>
                    {problemas.length ? <AlertTriangle className="h-3.5 w-3.5 text-amber" aria-label="Revisar texto" /> : <CheckCircle2 className="h-3.5 w-3.5 text-success" aria-label="Texto ok" />}
                  </span>
                  {e.assunto && <span className="truncate text-xs text-muted-foreground">Assunto: {e.assunto}</span>}
                  <span className="line-clamp-2 text-xs text-muted-foreground">{e.texto || "(sem nota)"}</span>
                  {(e.textoB || e.assuntoB) && <span className="flex items-center gap-1 text-[11px] font-medium text-primary"><FlaskConical className="h-3 w-3" /> com variante B</span>}
                  <AvisosCopy problemas={problemas} />
                </li>
              );
            })}
            {!etapas.length && <li className="text-xs text-muted-foreground">A linha do tempo aparece aqui enquanto você escreve.</li>}
          </ol>
        </div>

        {(erros.length > 0 || erro) && (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{[...erros, ...(erro ? [erro] : [])].join(" ")}</AlertDescription>
          </Alert>
        )}

        <DialogFooter className="gap-2">
          {temExistentes && <p className="mr-auto text-xs text-muted-foreground">Salvar substitui as {etapasExistentes.length} etapas atuais. Quem já está no meio da cadência segue da etapa em que parou.</p>}
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="button" onClick={criar} disabled={salvando || !etapas.length || erros.length > 0}>
            {salvando && <Loader2 className="h-4 w-4 animate-spin" />} {temExistentes ? "Salvar cadência" : `Criar ${etapas.length} etapa${etapas.length === 1 ? "" : "s"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Grava a cadência escrita em cima das etapas existentes SEM apagar e
 * recriar: etapa N vira PATCH da etapa N atual (alvos no meio da cadência
 * seguem de onde pararam, e o histórico continua apontando pra etapa certa),
 * etapas a mais viram POST e as que sobraram viram DELETE — que o banco
 * recusa se a etapa já foi enviada pra alguém.
 */
export async function aplicarCadenciaEscrita(
  stepsUrl: string,
  existentes: Array<{ id: string; ordem: number }>,
  novas: EtapaEscrita[],
  corpo: (e: EtapaEscrita, criando: boolean) => Record<string, unknown>,
): Promise<string | null> {
  const ordenadas = [...existentes].sort((a, b) => a.ordem - b.ordem);
  for (let i = 0; i < novas.length; i++) {
    const atual = ordenadas[i];
    const resp = atual
      ? await fetch(`${stepsUrl}/${atual.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo(novas[i], false)) }).catch(() => null)
      : await fetch(stepsUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ordem: i + 1, ...corpo(novas[i], true) }) }).catch(() => null);
    if (!resp?.ok) {
      const data = await resp?.json().catch(() => ({}));
      return `Etapa ${i + 1}: ${data?.error || "não foi possível salvar."}`;
    }
  }
  for (const sobra of ordenadas.slice(novas.length)) {
    const resp = await fetch(`${stepsUrl}/${sobra.id}`, { method: "DELETE" }).catch(() => null);
    if (!resp?.ok) {
      const data = await resp?.json().catch(() => ({}));
      return `Etapa ${sobra.ordem}: ${data?.error || "não foi possível remover."}`;
    }
  }
  return null;
}
