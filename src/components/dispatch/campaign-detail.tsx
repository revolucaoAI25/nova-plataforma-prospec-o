"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Play, Pause, UserPlus, Sheet as SheetIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import type { BadgeProps } from "@/components/ui/badge";
import type {
  CadenceStepRow,
  DispatchCampaignRow,
  WhatsappInstanceRow,
  DispatchTargetRow,
  SheetWatcherRow,
  MessageTemplateRow,
  SearchRow,
} from "@/lib/database.types";

const TARGET_STATUS_LABEL: Record<string, { label: string; variant: BadgeProps["variant"] }> = {
  pendente: { label: "Pendente", variant: "outline" },
  enviando: { label: "Enviando…", variant: "secondary" },
  enviado: { label: "Enviado", variant: "success" },
  concluido: { label: "Concluído", variant: "success" },
  falhou: { label: "Falhou", variant: "destructive" },
  removido: { label: "Removido", variant: "outline" },
};

/** Aceita URL completa ("…/spreadsheets/d/ID/edit") ou o ID direto. */
function extrairSheetId(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : trimmed;
}

function SheetWatcherCard({ campaignId, watcherInicial }: { campaignId: string; watcherInicial: SheetWatcherRow | null }) {
  const [watcher, setWatcher] = useState(watcherInicial);
  const [sheetUrl, setSheetUrl] = useState("");
  const [abaNome, setAbaNome] = useState("Leads");
  const [colunaTelefone, setColunaTelefone] = useState("Telefone");
  const [colunaNome, setColunaNome] = useState("Nome");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function configurar(e: React.FormEvent) {
    e.preventDefault();
    const sheetId = extrairSheetId(sheetUrl);
    if (!sheetId || !abaNome.trim() || !colunaTelefone.trim()) return;
    setSaving(true);
    setError(null);
    const resp = await fetch(`/api/dispatch/campaigns/${campaignId}/sheet-watcher`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sheetId, abaNome, colunaTelefone, colunaNome: colunaNome || undefined }),
    });
    const data = await resp.json();
    setSaving(false);
    if (!resp.ok) {
      setError(data.error || "Não foi possível configurar o monitoramento.");
      return;
    }
    setWatcher({
      id: data.id,
      campaign_id: campaignId,
      sheet_id: sheetId,
      aba_nome: abaNome,
      coluna_telefone: colunaTelefone,
      coluna_nome: colunaNome || null,
      ultima_linha_processada: 0,
      criado_em: new Date().toISOString(),
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><SheetIcon className="h-4 w-4" /> Monitorar planilha</CardTitle>
        <CardDescription>
          Novas linhas na planilha viram alvos automaticamente (checado periodicamente pelo worker de fundo).
        </CardDescription>
      </CardHeader>
      <CardContent>
        {watcher ? (
          <div className="flex flex-col gap-2 rounded-xl border border-primary/20 bg-accent p-3 text-sm">
            <div className="flex items-center gap-2">
              <Badge variant="success">Ativo</Badge>
              <span className="text-accent-foreground">
                Aba <strong>{watcher.aba_nome}</strong>, coluna telefone <strong>{watcher.coluna_telefone}</strong>
                {watcher.coluna_nome ? <>, coluna nome <strong>{watcher.coluna_nome}</strong></> : ""}
              </span>
            </div>
            <a
              href={`https://docs.google.com/spreadsheets/d/${watcher.sheet_id}`}
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline"
            >
              Abrir planilha
            </a>
            <p className="text-xs text-muted-foreground">Última linha processada: {watcher.ultima_linha_processada}</p>
          </div>
        ) : (
          <form onSubmit={configurar} className="flex flex-col gap-3">
            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="watcher-url">Link ou ID da planilha</Label>
              <Input id="watcher-url" value={sheetUrl} onChange={(e) => setSheetUrl(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/…" />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="watcher-aba">Aba</Label>
                <Input id="watcher-aba" value={abaNome} onChange={(e) => setAbaNome(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="watcher-col-tel">Coluna telefone</Label>
                <Input id="watcher-col-tel" value={colunaTelefone} onChange={(e) => setColunaTelefone(e.target.value)} placeholder="Telefone ou B" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="watcher-col-nome">Coluna nome (opcional)</Label>
                <Input id="watcher-col-nome" value={colunaNome} onChange={(e) => setColunaNome(e.target.value)} placeholder="Nome ou A" />
              </div>
            </div>
            <Button type="submit" disabled={saving} className="self-start">
              {saving ? "Configurando…" : "Ativar monitoramento"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

export function CampaignDetail({
  campanha,
  etapasIniciais,
  statsIniciais,
  instancias,
  pesquisas,
  targetsIniciais,
  watcherInicial,
  templates,
}: {
  campanha: DispatchCampaignRow;
  etapasIniciais: CadenceStepRow[];
  statsIniciais: Record<string, number>;
  instancias: WhatsappInstanceRow[];
  pesquisas: SearchRow[];
  targetsIniciais: DispatchTargetRow[];
  watcherInicial: SheetWatcherRow | null;
  templates: MessageTemplateRow[];
}) {
  const router = useRouter();
  const [status, setStatus] = useState(campanha.status);
  const [etapas, setEtapas] = useState(etapasIniciais);
  const [stats, setStats] = useState(statsIniciais);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  const [modoMensagem, setModoMensagem] = useState<"texto" | "template">("texto");
  const [templateId, setTemplateId] = useState("");
  const [atrasoHoras, setAtrasoHoras] = useState(0);
  const [corpoMensagem, setCorpoMensagem] = useState("");
  const [addingStep, setAddingStep] = useState(false);

  const [searchId, setSearchId] = useState("");
  const [manualLista, setManualLista] = useState("");
  const [enrolling, setEnrolling] = useState(false);

  const instancia = instancias.find((i) => i.id === campanha.instance_id);
  const canalOficial = instancia?.canal === "oficial";
  const templatesAprovados = templates.filter((t) => t.instance_id === instancia?.id && t.status_aprovacao === "approved");

  async function alternarStatus() {
    const novo = status === "ativa" ? "pausada" : "ativa";
    const resp = await fetch(`/api/dispatch/campaigns/${campanha.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: novo }),
    });
    if (resp.ok) setStatus(novo);
  }

  async function adicionarEtapa(e: React.FormEvent) {
    e.preventDefault();
    const corpo = modoMensagem === "template" ? templatesAprovados.find((t) => t.id === templateId)?.corpo || "" : corpoMensagem;
    if (!corpo.trim() || (modoMensagem === "template" && !templateId)) return;
    setAddingStep(true);
    const resp = await fetch(`/api/dispatch/campaigns/${campanha.id}/steps`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ordem: etapas.length + 1,
        atrasoHoras,
        corpoMensagem: corpo,
        templateId: modoMensagem === "template" ? templateId : undefined,
      }),
    });
    setAddingStep(false);
    if (resp.ok) {
      setCorpoMensagem("");
      setTemplateId("");
      setAtrasoHoras(0);
      router.refresh();
      const listResp = await fetch(`/api/dispatch/campaigns/${campanha.id}`);
      const data = await listResp.json();
      setEtapas(data.etapas || []);
    }
  }

  async function removerEtapa(stepId: string) {
    await fetch(`/api/dispatch/campaigns/${campanha.id}/steps/${stepId}`, { method: "DELETE" });
    setEtapas((prev) => prev.filter((e) => e.id !== stepId));
  }

  async function inscrever() {
    if (!etapas.length) {
      setFeedback({ ok: false, msg: "Crie ao menos uma etapa de cadência antes de inscrever alvos." });
      return;
    }
    setEnrolling(true);
    setFeedback(null);

    const body: Record<string, unknown> = {};
    if (searchId) {
      body.searchId = searchId;
    } else if (manualLista.trim()) {
      body.leads = manualLista
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => {
          const [nome, telefone] = l.split(",").map((x) => x.trim());
          return telefone ? { nome, telefone } : { nome: "", telefone: nome };
        });
    } else {
      setFeedback({ ok: false, msg: "Escolha uma pesquisa do histórico ou cole uma lista de nome,telefone." });
      setEnrolling(false);
      return;
    }

    const resp = await fetch(`/api/dispatch/campaigns/${campanha.id}/enroll`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await resp.json();
    setEnrolling(false);
    if (!resp.ok) {
      setFeedback({ ok: false, msg: data.error || "Não foi possível inscrever os alvos." });
      return;
    }
    setFeedback({
      ok: true,
      msg: `${data.inscritos} inscritos · ${data.duplicados} duplicados · ${data.opt_out} em opt-out · ${data.invalidos} inválidos.`,
    });
    setManualLista("");
    setSearchId("");
    router.refresh();
    const statsResp = await fetch(`/api/dispatch/campaigns/${campanha.id}`);
    const statsData = await statsResp.json();
    setStats(statsData.stats || stats);
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Status</CardTitle>
            <CardDescription>Instância: {instancia?.nome ?? "—"} {canalOficial && "· Canal oficial"}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={status === "ativa" ? "success" : "outline"}>{status}</Badge>
            <Button size="sm" onClick={alternarStatus} disabled={!etapas.length}>
              {status === "ativa" ? <><Pause className="h-4 w-4" /> Pausar</> : <><Play className="h-4 w-4" /> Ativar</>}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats).map(([k, v]) => (
              <Badge key={k} variant="secondary">{k}: {v}</Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cadência de mensagens</CardTitle>
          <CardDescription>Cada etapa dispara após o atraso configurado desde a etapa anterior (ou desde a inscrição, na 1ª).</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {etapas.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma etapa criada ainda.</p>}
          {etapas.map((e) => (
            <div key={e.id} className="flex items-start justify-between gap-3 rounded-xl border border-border p-3">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">
                  Etapa {e.ordem} · {e.atraso_horas}h de atraso {e.template_id && "· via template"}
                </p>
                <p className="whitespace-pre-wrap text-sm">{e.corpo_mensagem}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => removerEtapa(e.id)} className="shrink-0">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}

          <form onSubmit={adicionarEtapa} className="flex flex-col gap-3 rounded-xl border border-dashed border-border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Label htmlFor="atraso" className="shrink-0">Atraso (horas)</Label>
              <Input id="atraso" type="number" min={0} step={0.5} value={atrasoHoras} onChange={(e) => setAtrasoHoras(Number(e.target.value))} className="w-28" />

              {canalOficial && (
                <div className="ml-auto flex items-center gap-2">
                  <Label className="shrink-0 text-xs text-muted-foreground">Tipo</Label>
                  <Select value={modoMensagem} onValueChange={(v) => setModoMensagem(v as "texto" | "template")}>
                    <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="texto">Texto livre</SelectItem>
                      <SelectItem value="template">Template aprovado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {modoMensagem === "template" ? (
              templatesAprovados.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum template aprovado para essa instância ainda — crie e envie um para aprovação na página de Disparo.
                </p>
              ) : (
                <Select value={templateId} onValueChange={setTemplateId}>
                  <SelectTrigger><SelectValue placeholder="Escolher template aprovado" /></SelectTrigger>
                  <SelectContent>
                    {templatesAprovados.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )
            ) : (
              <Textarea
                value={corpoMensagem}
                onChange={(e) => setCorpoMensagem(e.target.value)}
                placeholder="Corpo da mensagem — use {{nome}} para inserir o nome do lead"
                rows={3}
              />
            )}

            <Button type="submit" disabled={addingStep} className="self-start">
              <Plus className="h-4 w-4" /> {addingStep ? "Adicionando…" : "Adicionar etapa"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Inscrever alvos</CardTitle>
          <CardDescription>De uma pesquisa do histórico, ou colando uma lista (uma linha por lead: nome,telefone).</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {feedback && (
            <Alert variant={feedback.ok ? "success" : "destructive"}>
              <AlertDescription>{feedback.msg}</AlertDescription>
            </Alert>
          )}
          <Select value={searchId} onValueChange={setSearchId}>
            <SelectTrigger><SelectValue placeholder="Escolher pesquisa do histórico" /></SelectTrigger>
            <SelectContent>
              {pesquisas.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {(p.nicho || p.localidade || "Pesquisa")} — {p.total_results} leads
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-center text-xs text-muted-foreground">ou</span>
          <Textarea
            value={manualLista}
            onChange={(e) => setManualLista(e.target.value)}
            placeholder={"João Silva,5511999999999\nMaria Souza,5511988888888"}
            rows={4}
          />
          <Button onClick={inscrever} disabled={enrolling} className="self-start">
            <UserPlus className="h-4 w-4" /> {enrolling ? "Inscrevendo…" : "Inscrever"}
          </Button>
        </CardContent>
      </Card>

      <SheetWatcherCard campaignId={campanha.id} watcherInicial={watcherInicial} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Alvos inscritos</CardTitle>
          <CardDescription>{targetsIniciais.length} no total.</CardDescription>
        </CardHeader>
        <CardContent>
          {targetsIniciais.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum alvo inscrito ainda.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Próxima etapa</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {targetsIniciais.slice(0, 200).map((t) => {
                  const s = TARGET_STATUS_LABEL[t.status] ?? { label: t.status, variant: "outline" as const };
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="max-w-[220px] truncate font-medium">{t.nome || "—"}</TableCell>
                      <TableCell>{t.telefone}</TableCell>
                      <TableCell><Badge variant={s.variant}>{s.label}</Badge></TableCell>
                      <TableCell>{t.proxima_etapa_em ? new Date(t.proxima_etapa_em).toLocaleString("pt-BR") : "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
          {targetsIniciais.length > 200 && (
            <p className="border-t border-border p-3 text-center text-xs text-muted-foreground">
              Mostrando 200 de {targetsIniciais.length} alvos.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
