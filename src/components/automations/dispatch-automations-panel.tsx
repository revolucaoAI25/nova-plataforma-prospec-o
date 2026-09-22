"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Pause, Play, ArrowRight, Target, Sheet as SheetIcon, Zap } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { ESTADOS } from "@/lib/data/estados";
import type { DispatchCampaignRow, WhatsappInstanceRow } from "@/lib/database.types";

type Gatilho = "filtro" | "planilha";

/** Aceita URL completa ("…/spreadsheets/d/ID/edit") ou o ID direto. */
function extrairSheetId(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : trimmed;
}

export function DispatchAutomationsPanel({
  campanhasIniciais,
  instancias,
}: {
  campanhasIniciais: DispatchCampaignRow[];
  instancias: WhatsappInstanceRow[];
}) {
  const router = useRouter();
  const [campanhas, setCampanhas] = useState(campanhasIniciais);
  const [open, setOpen] = useState(false);

  const [nome, setNome] = useState("");
  const [instanceId, setInstanceId] = useState(instancias[0]?.id ?? "");
  const [gatilho, setGatilho] = useState<Gatilho>("filtro");
  const [filtroNicho, setFiltroNicho] = useState("");
  const [filtroSubnicho, setFiltroSubnicho] = useState("");
  const [filtroUf, setFiltroUf] = useState("");
  const [sheetUrl, setSheetUrl] = useState("");
  const [abaNome, setAbaNome] = useState("Leads");
  const [colunaTelefone, setColunaTelefone] = useState("Telefone");
  const [colunaNome, setColunaNome] = useState("Nome");
  const [intervaloMin, setIntervaloMin] = useState(30);
  const [intervaloMax, setIntervaloMax] = useState(90);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!nome.trim() || !instanceId) {
      setError("Dê um nome e escolha uma instância.");
      return;
    }
    if (gatilho === "filtro" && !filtroNicho.trim() && !filtroSubnicho.trim() && !filtroUf) {
      setError("Preencha ao menos um critério de filtro (nicho, subnicho ou UF).");
      return;
    }
    const sheetId = gatilho === "planilha" ? extrairSheetId(sheetUrl) : "";
    if (gatilho === "planilha" && (!sheetId || !abaNome.trim() || !colunaTelefone.trim())) {
      setError("Preencha a planilha, a aba e a coluna de telefone.");
      return;
    }

    setCreating(true);
    const resp = await fetch("/api/dispatch/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome,
        instanceId,
        tipoOrigem: gatilho === "filtro" ? "auto_trigger" : "sheet_watch",
        filtroNicho: gatilho === "filtro" ? filtroNicho : undefined,
        filtroSubnicho: gatilho === "filtro" ? filtroSubnicho : undefined,
        filtroUf: gatilho === "filtro" ? filtroUf : undefined,
        intervaloMinSeg: intervaloMin,
        intervaloMaxSeg: intervaloMax,
      }),
    });
    const data = await resp.json();
    if (!resp.ok) {
      setError(data.error || "Não foi possível criar a automação de disparo.");
      setCreating(false);
      return;
    }

    if (gatilho === "planilha") {
      const watcherResp = await fetch(`/api/dispatch/campaigns/${data.id}/sheet-watcher`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheetId, abaNome, colunaTelefone, colunaNome: colunaNome || undefined }),
      });
      if (!watcherResp.ok) {
        setError("Campanha criada, mas não foi possível configurar o monitoramento da planilha — configure na página da campanha.");
        setCreating(false);
        router.push(`/disparo/campanhas/${data.id}`);
        return;
      }
    }

    router.push(`/disparo/campanhas/${data.id}`);
  }

  async function alternarStatus(campanha: DispatchCampaignRow) {
    const novo = campanha.status === "ativa" ? "pausada" : "ativa";
    const resp = await fetch(`/api/dispatch/campaigns/${campanha.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: novo }),
    });
    if (resp.ok) {
      setCampanhas((prev) => prev.map((c) => (c.id === campanha.id ? { ...c, status: novo } : c)));
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <CardTitle className="flex items-center gap-2 text-base"><Zap className="h-4 w-4 text-primary" /> Automações de disparo (WhatsApp)</CardTitle>
          <CardDescription>
            Campanhas que rodam sozinhas: disparam quando um lead seu bate com um filtro, ou quando uma planilha
            monitorada ganha linhas novas.
          </CardDescription>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen((o) => !o)}>
          <Plus className="h-4 w-4" /> Nova automação de disparo
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

        {open && (
          <form onSubmit={criar} className="flex flex-col gap-4 rounded-xl border border-dashed border-border p-4">
            {instancias.length === 0 ? (
              <p className="text-sm text-muted-foreground">Conecte uma instância WhatsApp em Disparo → Instâncias antes de criar isso.</p>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="ad-nome">Nome</Label>
                    <Input id="ad-nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Recuperação judicial SP" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>Instância WhatsApp</Label>
                    <Select value={instanceId} onValueChange={setInstanceId}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {instancias.map((i) => (
                          <SelectItem key={i.id} value={i.id}>{i.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <Label>Gatilho</Label>
                  <RadioGroup value={gatilho} onValueChange={(v) => setGatilho(v as Gatilho)} className="flex gap-6">
                    <label className="flex items-center gap-2 text-sm">
                      <RadioGroupItem value="filtro" id="ad-gatilho-filtro" />
                      <Target className="h-3.5 w-3.5 text-muted-foreground" /> Filtro específico
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <RadioGroupItem value="planilha" id="ad-gatilho-planilha" />
                      <SheetIcon className="h-3.5 w-3.5 text-muted-foreground" /> Monitorar planilha
                    </label>
                  </RadioGroup>
                </div>

                {gatilho === "filtro" ? (
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="ad-nicho">Nicho</Label>
                      <Input id="ad-nicho" value={filtroNicho} onChange={(e) => setFiltroNicho(e.target.value)} placeholder="Ex: advogado" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="ad-subnicho">Subnicho (opcional)</Label>
                      <Input id="ad-subnicho" value={filtroSubnicho} onChange={(e) => setFiltroSubnicho(e.target.value)} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label>UF (opcional)</Label>
                      <Select value={filtroUf || "__none"} onValueChange={(v) => setFiltroUf(v === "__none" ? "" : v)}>
                        <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none">Todos</SelectItem>
                          {Object.entries(ESTADOS).map(([sigla, nome]) => (
                            <SelectItem key={sigla} value={sigla}>{sigla} — {nome}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <p className="col-span-full text-xs text-muted-foreground">
                      Dispara pra leads que você já extraiu (ou vier a extrair) batendo com esse filtro. Não considera
                      extrações de outros usuários da plataforma.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="flex flex-col gap-1.5 sm:col-span-3">
                      <Label htmlFor="ad-sheet-url">Link ou ID da planilha</Label>
                      <Input id="ad-sheet-url" value={sheetUrl} onChange={(e) => setSheetUrl(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/…" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="ad-aba">Aba</Label>
                      <Input id="ad-aba" value={abaNome} onChange={(e) => setAbaNome(e.target.value)} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="ad-col-tel">Coluna telefone</Label>
                      <Input id="ad-col-tel" value={colunaTelefone} onChange={(e) => setColunaTelefone(e.target.value)} placeholder="Telefone ou B" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="ad-col-nome">Coluna nome (opcional)</Label>
                      <Input id="ad-col-nome" value={colunaNome} onChange={(e) => setColunaNome(e.target.value)} placeholder="Nome ou A" />
                    </div>
                  </div>
                )}

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="ad-int-min">Intervalo mínimo (s)</Label>
                    <Input id="ad-int-min" type="number" min={5} step={5} value={intervaloMin} onChange={(e) => setIntervaloMin(Number(e.target.value))} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="ad-int-max">Intervalo máximo (s)</Label>
                    <Input id="ad-int-max" type="number" min={5} step={5} value={intervaloMax} onChange={(e) => setIntervaloMax(Number(e.target.value))} />
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  Depois de criar, você adiciona as etapas de cadência e ativa a campanha na página dela.
                </p>
                <Button type="submit" disabled={creating} className="self-start">
                  {creating ? "Criando…" : "Criar automação de disparo"}
                </Button>
              </>
            )}
          </form>
        )}

        {campanhas.length === 0 ? (
          <EmptyState
            icon={Zap}
            title="Nenhuma automação de disparo criada ainda"
            description="Crie um gatilho por filtro ou monitore uma planilha para disparar mensagens automaticamente."
          />
        ) : (
          <ul className="divide-y divide-border">
            {campanhas.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <Link href={`/disparo/campanhas/${c.id}`} className="font-medium hover:underline">{c.nome}</Link>
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {c.tipo_origem === "auto_trigger" ? <Target className="h-3 w-3" /> : <SheetIcon className="h-3 w-3" />}
                    {c.tipo_origem === "auto_trigger" ? "Gatilho por filtro" : "Monitorando planilha"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant={c.status === "ativa" ? "success" : "outline"}>{c.status}</Badge>
                  <Button type="button" variant="ghost" size="icon" onClick={() => alternarStatus(c)} title={c.status === "ativa" ? "Pausar" : "Ativar"}>
                    {c.status === "ativa" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </Button>
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/disparo/campanhas/${c.id}`}>Gerenciar <ArrowRight className="h-4 w-4" /></Link>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
