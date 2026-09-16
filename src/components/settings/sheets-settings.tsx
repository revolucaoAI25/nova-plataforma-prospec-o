"use client";

import { useEffect, useState } from "react";
import { Sheet, Link2, Unlink, Star, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import type { Profile, SheetConfig } from "@/lib/database.types";

export function SheetsSettings({ profile, initialFeedback }: { profile: Profile; initialFeedback?: string | null }) {
  const conectado = Boolean(profile.google_sheets_creds?.oauth);
  const [planilhas, setPlanilhas] = useState<SheetConfig[]>(profile.google_sheets_creds?.planilhas || []);
  const [autoExport, setAutoExport] = useState(profile.google_sheets_creds?.auto_export || false);
  const [disponiveis, setDisponiveis] = useState<Array<{ id: string; name: string }>>([]);
  const [abasPorSheet, setAbasPorSheet] = useState<Record<string, string[]>>({});
  const [novaPlanilha, setNovaPlanilha] = useState("");
  const [loadingList, setLoadingList] = useState(conectado);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(
    initialFeedback === "conectado" ? { ok: true, msg: "Conta Google conectada com sucesso." } : initialFeedback === "erro" ? { ok: false, msg: "Não foi possível conectar sua conta Google." } : null,
  );

  useEffect(() => {
    if (!conectado) return;
    fetch("/api/integrations/google-sheets/spreadsheets")
      .then((r) => r.json())
      .then((d) => setDisponiveis(d.planilhas || []))
      .finally(() => setLoadingList(false));
  }, [conectado]);

  async function carregarAbas(sheetId: string) {
    if (abasPorSheet[sheetId]) return;
    const resp = await fetch(`/api/integrations/google-sheets/spreadsheets?sheetId=${sheetId}`);
    const data = await resp.json();
    setAbasPorSheet((prev) => ({ ...prev, [sheetId]: data.abas || [] }));
  }

  function adicionarPlanilha() {
    const p = disponiveis.find((d) => d.id === novaPlanilha);
    if (!p || planilhas.some((x) => x.id === p.id)) return;
    setPlanilhas([...planilhas, { id: p.id, nome: p.name, aba: "Planilha1", modo: "substituir", padrao: planilhas.length === 0 }]);
    setNovaPlanilha("");
  }

  function atualizarPlanilha(id: string, campos: Partial<SheetConfig>) {
    setPlanilhas((prev) => prev.map((p) => (p.id === id ? { ...p, ...campos } : p)));
  }

  function definirPadrao(id: string) {
    setPlanilhas((prev) => prev.map((p) => ({ ...p, padrao: p.id === id })));
  }

  function removerPlanilha(id: string) {
    setPlanilhas((prev) => prev.filter((p) => p.id !== id));
  }

  async function salvar() {
    setSaving(true);
    setFeedback(null);
    const resp = await fetch("/api/integrations/google-sheets/config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planilhas, autoExport }),
    });
    setFeedback(resp.ok ? { ok: true, msg: "Configurações salvas." } : { ok: false, msg: "Não foi possível salvar." });
    setSaving(false);
  }

  async function desconectar() {
    if (!confirm("Desconectar sua conta Google? A configuração de planilhas será perdida.")) return;
    await fetch("/api/integrations/google-sheets/disconnect", { method: "POST" });
    window.location.reload();
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sheet className="h-4 w-4" /> Google Sheets
          </CardTitle>
          <CardDescription>
            Conecte sua conta Google para exportar resultados direto para uma planilha, com opção de exportação
            automática após cada busca.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {feedback && (
            <Alert variant={feedback.ok ? "success" : "destructive"}>
              <AlertDescription>{feedback.msg}</AlertDescription>
            </Alert>
          )}

          {!conectado ? (
            <Button asChild className="self-start">
              <a href="/api/integrations/google-sheets/connect">
                <Link2 className="h-4 w-4" /> Conectar conta Google
              </a>
            </Button>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <Badge variant="success">Conectado</Badge>
                <Button type="button" variant="ghost" size="sm" onClick={desconectar}>
                  <Unlink className="h-4 w-4" /> Desconectar
                </Button>
              </div>

              <label className="flex items-center justify-between rounded-md border border-border p-3 text-sm">
                <span>
                  Exportar automaticamente após cada busca
                  <span className="block text-xs font-normal text-muted-foreground">Usa a planilha marcada como principal, no modo configurado.</span>
                </span>
                <Switch checked={autoExport} onCheckedChange={setAutoExport} />
              </label>

              <div className="flex flex-col gap-3">
                <span className="text-sm font-medium">Planilhas configuradas</span>
                {planilhas.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma planilha adicionada ainda.</p>}
                {planilhas.map((p) => (
                  <div key={p.id} className="flex flex-col gap-2 rounded-md border border-border p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{p.nome}</span>
                      <div className="flex items-center gap-1">
                        <Button type="button" variant={p.padrao ? "default" : "ghost"} size="sm" onClick={() => definirPadrao(p.id)}>
                          <Star className="h-3.5 w-3.5" /> {p.padrao ? "Principal" : "Definir como principal"}
                        </Button>
                        <Button type="button" variant="ghost" size="icon" onClick={() => removerPlanilha(p.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Select value={p.aba} onValueChange={(v) => atualizarPlanilha(p.id, { aba: v })} onOpenChange={(open) => open && carregarAbas(p.id)}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(abasPorSheet[p.id] || [p.aba]).map((aba) => (
                            <SelectItem key={aba} value={aba}>{aba}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={p.modo} onValueChange={(v) => atualizarPlanilha(p.id, { modo: v as SheetConfig["modo"] })}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="substituir">Substituir</SelectItem>
                          <SelectItem value="acrescentar">Acrescentar</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}

                <div className="flex gap-2">
                  <Select value={novaPlanilha} onValueChange={setNovaPlanilha}>
                    <SelectTrigger className="h-9"><SelectValue placeholder={loadingList ? "Carregando…" : "Escolher planilha"} /></SelectTrigger>
                    <SelectContent>
                      {disponiveis.filter((d) => !planilhas.some((p) => p.id === d.id)).map((d) => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="button" variant="outline" onClick={adicionarPlanilha} disabled={!novaPlanilha}>
                    Adicionar
                  </Button>
                </div>
              </div>

              <Button type="button" onClick={salvar} disabled={saving} className="self-start">
                {saving ? "Salvando…" : "Salvar"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
