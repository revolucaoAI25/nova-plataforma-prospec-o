"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Building2, BriefcaseBusiness, Check, Copy, ExternalLink, Loader2, Mail, MessageCircle, Phone, Send, Trash2, UserRound,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useConfirm } from "@/components/ui/confirm-provider";
import { resumoDoCard } from "@/lib/funil-resumo";
import { rotuloFonte } from "@/lib/fonte";
import { capitalizar } from "@/lib/mensagem";
import type { FunilCardRow, FunilColunaRow } from "@/lib/database.types";
import type { CampanhaDoContato, MensagemDoContato, CanalAtividade } from "@/lib/funil-historico";

const STATUS_ALVO: Record<string, string> = {
  pendente: "Na fila",
  enviando: "Enviando",
  enviado: "Em cadência",
  aguardando_aceite: "Aguardando aceite",
  concluido: "Cadência concluída",
  respondeu: "Respondeu",
  falhou: "Falhou",
  removido: "Removido",
};

const CANAL: Record<CanalAtividade, { rotulo: string; Icone: typeof Phone }> = {
  whatsapp: { rotulo: "WhatsApp", Icone: MessageCircle },
  email: { rotulo: "E-mail", Icone: Mail },
  linkedin: { rotulo: "LinkedIn", Icone: BriefcaseBusiness },
};

const dataHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

function BotaoCopiar({ texto, rotulo }: { texto: string; rotulo: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-8 w-8"
      aria-label={`Copiar ${rotulo}`}
      title={`Copiar ${rotulo}`}
      onClick={async () => {
        await navigator.clipboard.writeText(texto).catch(() => {});
        setCopiado(true);
        setTimeout(() => setCopiado(false), 1500);
      }}
    >
      {copiado ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-2">{titulo}</h3>
      {children}
    </section>
  );
}

/**
 * Detalhe do negócio: todos os contatos (telefones da empresa e de cada
 * sócio, e-mails, LinkedIn), dados da empresa, anotações, em que campanhas
 * cada contato está e as últimas mensagens. Também move de etapa (a
 * alternativa ao arraste — que não funciona no celular) e remove.
 */
export function FunilCardDetalhe({
  funilId, card, colunas, onFechar, onMover, onRemovido, onAnotacoes,
}: {
  funilId: string;
  card: FunilCardRow;
  colunas: FunilColunaRow[];
  onFechar: () => void;
  onMover: (colunaId: string) => void;
  onRemovido: () => void;
  onAnotacoes: (texto: string) => void;
}) {
  const confirmar = useConfirm();
  const s = useMemo(() => (card.lead_snapshot || {}) as Record<string, unknown>, [card.lead_snapshot]);
  const r = useMemo(() => resumoDoCard(s), [s]);
  const [historico, setHistorico] = useState<{ campanhas: CampanhaDoContato[]; mensagens: MensagemDoContato[] } | null>(null);
  const [erroHistorico, setErroHistorico] = useState(false);
  const [anotacoes, setAnotacoes] = useState(card.anotacoes ?? "");
  const [salvando, setSalvando] = useState<"" | "salvando" | "salvo" | "erro">("");
  const [removendo, setRemovendo] = useState(false);

  useEffect(() => {
    let vivo = true;
    fetch(`/api/funis/${funilId}/cards/${card.id}`)
      .then((resp) => (resp.ok ? resp.json() : Promise.reject()))
      .then((data) => vivo && setHistorico({ campanhas: data.campanhas ?? [], mensagens: data.mensagens ?? [] }))
      .catch(() => vivo && setErroHistorico(true));
    return () => {
      vivo = false;
    };
  }, [funilId, card.id]);

  async function salvarAnotacoes() {
    if (anotacoes === (card.anotacoes ?? "")) return;
    setSalvando("salvando");
    const resp = await fetch(`/api/funis/${funilId}/cards/${card.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anotacoes }),
    }).catch(() => null);
    setSalvando(resp?.ok ? "salvo" : "erro");
    if (resp?.ok) onAnotacoes(anotacoes);
  }

  async function remover() {
    if (!(await confirmar({ title: "Remover do funil?", description: "O negócio sai do board. Campanhas em andamento continuam.", destructive: true }))) return;
    setRemovendo(true);
    const resp = await fetch(`/api/funis/${funilId}/cards/${card.id}`, { method: "DELETE" }).catch(() => null);
    setRemovendo(false);
    if (resp?.ok) onRemovido();
  }

  const rua = String(s.endereco ?? "").trim();
  const cidadeUf = [capitalizar(String(s.municipio ?? "")), String(s.uf ?? "").trim()].filter(Boolean).join("/");
  const endereco = rua && cidadeUf && !rua.toLowerCase().includes(String(s.municipio ?? "").toLowerCase()) ? `${rua} · ${cidadeUf}` : rua || cidadeUf;
  const dadosEmpresa: Array<[string, string]> = [
    ["CNPJ", String(s.cnpj ?? "")],
    ["Endereço", endereco],
    ["Porte", String(s.porte ?? "")],
    ["Ramo", capitalizar(String(s.nicho ?? s.nicho_busca ?? ""))],
    ["Avaliação", s.avaliacao ? `${s.avaliacao} (${s.total_avaliacoes ?? 0} avaliações)` : ""],
    ["Origem", rotuloFonte(s.fonte)],
  ].filter(([, v]) => v && v.trim()) as Array<[string, string]>;
  const site = String(s.site ?? "").trim();
  const mapsUrl = String(s.maps_url ?? "").trim();

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && onFechar()}>
      <DialogContent className="flex max-h-[90dvh] max-w-2xl flex-col gap-5 overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="leading-snug">{r.titulo}</DialogTitle>
          {r.subtitulo && <DialogDescription className="flex items-center gap-1.5"><UserRound className="h-3.5 w-3.5" /> {r.subtitulo}</DialogDescription>}
        </DialogHeader>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="card-etapa">Etapa</Label>
          <Select value={card.coluna_id} onValueChange={onMover}>
            <SelectTrigger id="card-etapa" className="sm:w-64"><SelectValue /></SelectTrigger>
            <SelectContent>
              {colunas.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <Secao titulo={`Contatos (${r.telefones.length + r.emails.length + (r.linkedin ? 1 : 0)})`}>
          {r.telefones.length + r.emails.length === 0 && !r.linkedin && (
            <p className="text-sm text-muted-foreground">Nenhum contato neste negócio.</p>
          )}
          <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
            {r.telefones.map((t) => (
              <li key={t.numero} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="font-medium tabular-nums text-foreground">{t.exibicao}</span>
                  <span className="text-xs text-muted-foreground">
                    {t.rotulo}{t.nome ? ` · ${t.nome}` : ""}{t.cargo ? ` (${capitalizar(t.cargo)})` : ""}{t.whatsapp ? " · tem WhatsApp" : ""}
                  </span>
                </div>
                <div className="flex items-center">
                  {t.e164 && (
                    <Button asChild variant="ghost" size="icon" className="h-8 w-8" title="Abrir no WhatsApp">
                      <a href={`https://wa.me/${t.e164}`} target="_blank" rel="noreferrer" aria-label={`Abrir ${t.exibicao} no WhatsApp`}>
                        <MessageCircle className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                  )}
                  <Button asChild variant="ghost" size="icon" className="h-8 w-8" title="Ligar">
                    <a href={`tel:+${t.e164 || t.numero}`} aria-label={`Ligar para ${t.exibicao}`}><Phone className="h-3.5 w-3.5" /></a>
                  </Button>
                  <BotaoCopiar texto={t.exibicao} rotulo="telefone" />
                </div>
              </li>
            ))}
            {r.emails.map((e) => (
              <li key={e} className="flex items-center gap-3 px-3 py-2">
                <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate text-foreground">{e}</span>
                <Button asChild variant="ghost" size="icon" className="h-8 w-8" title="Escrever e-mail">
                  <a href={`mailto:${e}`} aria-label={`Escrever para ${e}`}><Send className="h-3.5 w-3.5" /></a>
                </Button>
                <BotaoCopiar texto={e} rotulo="e-mail" />
              </li>
            ))}
            {r.linkedin && (
              <li className="flex items-center gap-3 px-3 py-2">
                <BriefcaseBusiness className="h-4 w-4 shrink-0 text-muted-foreground" />
                <a href={r.linkedin} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-primary hover:underline">Perfil no LinkedIn</a>
              </li>
            )}
          </ul>
        </Secao>

        {(dadosEmpresa.length > 0 || site || mapsUrl) && (
          <Secao titulo="Empresa">
            <dl className="grid grid-cols-1 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[auto_1fr]">
              {dadosEmpresa.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="text-foreground">{v}</dd>
                </div>
              ))}
            </dl>
            {(site || mapsUrl) && (
              <div className="flex flex-wrap gap-2">
                {site && (
                  <Button asChild variant="outline" size="sm">
                    <a href={site.startsWith("http") ? site : `https://${site}`} target="_blank" rel="noreferrer"><Building2 className="h-3.5 w-3.5" /> Site <ExternalLink className="h-3 w-3" /></a>
                  </Button>
                )}
                {mapsUrl && (
                  <Button asChild variant="outline" size="sm">
                    <a href={mapsUrl} target="_blank" rel="noreferrer">Ver no mapa <ExternalLink className="h-3 w-3" /></a>
                  </Button>
                )}
              </div>
            )}
          </Secao>
        )}

        <Secao titulo="Anotações">
          <Textarea
            value={anotacoes}
            onChange={(e) => {
              setAnotacoes(e.target.value);
              setSalvando("");
            }}
            onBlur={salvarAnotacoes}
            rows={3}
            maxLength={5000}
            placeholder="O que foi conversado, próximo passo, melhor horário…"
            aria-label="Anotações do negócio"
          />
          <span className="text-xs text-muted-foreground" aria-live="polite">
            {salvando === "salvando" ? "Salvando…" : salvando === "salvo" ? "Salvo." : salvando === "erro" ? "Não foi possível salvar." : "Salva sozinho ao sair do campo."}
          </span>
        </Secao>

        <Secao titulo="Campanhas e mensagens">
          {!historico && !erroHistorico && (
            <span className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando…</span>
          )}
          {erroHistorico && <p className="text-sm text-destructive">Não deu para carregar o histórico agora.</p>}
          {historico && historico.campanhas.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum contato deste negócio está em campanha ainda.</p>
          )}
          {historico && historico.campanhas.length > 0 && (
            <ul className="flex flex-col gap-1.5">
              {historico.campanhas.map((c, i) => {
                const { Icone, rotulo } = CANAL[c.canal];
                return (
                  <li key={`${c.campanhaId}-${c.contato}-${i}`} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
                    <Icone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label={rotulo} />
                    <span className="font-medium text-foreground">{c.campanha}</span>
                    <span className="text-xs text-muted-foreground">{c.contato}</span>
                    <span className="ml-auto rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">{STATUS_ALVO[c.status] ?? c.status}</span>
                  </li>
                );
              })}
            </ul>
          )}
          {historico && historico.mensagens.length > 0 && (
            <ol className="mt-1 flex flex-col gap-2 border-l border-border pl-3">
              {historico.mensagens.map((m, i) => (
                <li key={i} className="flex flex-col gap-0.5 text-sm">
                  <span className="text-xs text-muted-foreground">
                    {dataHora(m.enviadoEm)} · {CANAL[m.canal].rotulo} · {m.campanha}
                    {m.status === "erro" ? " · falhou" : m.lidoEm ? " · lida" : m.entregueEm ? " · entregue" : ""}
                  </span>
                  {m.status === "erro" ? (
                    <span className="text-destructive">{m.erro || "Erro no envio."}</span>
                  ) : m.corpo ? (
                    <span className="line-clamp-3 whitespace-pre-line text-foreground">{m.corpo}</span>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </Secao>

        <div className="flex justify-between gap-2 border-t border-border pt-4">
          <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={remover} disabled={removendo}>
            <Trash2 className="h-4 w-4" /> Remover do funil
          </Button>
          <Button variant="outline" onClick={onFechar}>Fechar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
