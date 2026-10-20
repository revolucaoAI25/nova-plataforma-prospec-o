"use client";

import { useEffect, useState } from "react";
import { Sheet, Link2, Unlink, Star, Trash2 } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { FieldGroup, FieldRow, FieldGroupLabel } from "@/components/ui/field-group";
import { useConfirm } from "@/components/ui/confirm-provider";
import type { Profile, SheetConfig } from "@/lib/database.types";

export function SheetsSettings({
  profile,
  initialFeedback,
  oauthConfigured,
}: {
  profile: Profile;
  initialFeedback?: string | null;
  oauthConfigured: boolean;
}) {
  const confirmar = useConfirm();
  const conectado = Boolean(profile.google_sheets_creds?.oauth);
  const [planilhas, setPlanilhas] = useState<SheetConfig[]>(profile.google_sheets_creds?.planilhas || []);
  const [autoExport, setAutoExport] = useState(profile.google_sheets_creds?.auto_export || false);
  const [disponiveis, setDisponiveis] = useState<Array<{ id: string; name: string }>>([]);
  const [abasPorSheet, setAbasPorSheet] = useState<Record<string, string[]>>({});
  const [novaPlanilha, setNovaPlanilha] = useState("");
  const [loadingList, setLoadingList] = useState(conectado);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(
    initialFeedback === "conectado"
      ? { ok: true, msg: "Conta Google conectada com sucesso." }
      : initialFeedback === "nao_configurado"
        ? { ok: false, msg: "Integração com Google Sheets não configurada nesta plataforma (faltam GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET)." }
        : initialFeedback === "erro"
          ? { ok: false, msg: "Não foi possível conectar sua conta Google." }
          : null,
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

  // A mesma planilha pode entrar mais de uma vez, uma por aba: cada linha
  // é planilha + aba (as operações abaixo usam a posição na lista, não o id
  // da planilha, que se repete).
  async function adicionarPlanilha() {
    const p = disponiveis.find((d) => d.id === novaPlanilha);
    if (!p) return;
    setNovaPlanilha("");
    let abas = abasPorSheet[p.id];
    if (!abas) {
      const resp = await fetch(`/api/integrations/google-sheets/spreadsheets?sheetId=${p.id}`).catch(() => null);
      const data = resp?.ok ? await resp.json().catch(() => null) : null;
      abas = (data?.abas as string[] | undefined) ?? [];
      setAbasPorSheet((prev) => ({ ...prev, [p.id]: abas! }));
    }
    setPlanilhas((prev) => {
      const usadas = new Set(prev.filter((x) => x.id === p.id).map((x) => x.aba));
      const aba = abas!.find((a) => !usadas.has(a)) ?? abas![0] ?? "Planilha1";
      return [...prev, { id: p.id, nome: p.name, aba, modo: "substituir", padrao: prev.length === 0 }];
    });
  }

  function atualizarPlanilha(indice: number, campos: Partial<SheetConfig>) {
    setPlanilhas((prev) => prev.map((p, i) => (i === indice ? { ...p, ...campos } : p)));
  }

  function definirPadrao(indice: number) {
    setPlanilhas((prev) => prev.map((p, i) => ({ ...p, padrao: i === indice })));
  }

  function removerPlanilha(indice: number) {
    setPlanilhas((prev) => {
      const resto = prev.filter((_, i) => i !== indice);
      // Removeu a principal: a primeira que sobrou assume.
      return resto.length && !resto.some((p) => p.padrao) ? resto.map((p, i) => ({ ...p, padrao: i === 0 })) : resto;
    });
  }

  const repetidas = planilhas.filter((p, i) => planilhas.findIndex((q) => q.id === p.id && q.aba === p.aba) !== i);

  async function salvar() {
    if (repetidas.length) {
      setFeedback({ ok: false, msg: `A aba "${repetidas[0].aba}" de "${repetidas[0].nome}" está duas vezes. Troque a aba de uma delas ou remova.` });
      return;
    }
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
    if (!(await confirmar({ title: "Desconectar sua conta Google?", description: "A configuração de planilhas será perdida.", destructive: true }))) return;
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

          {!oauthConfigured ? (
            <Alert>
              <AlertDescription>
                Integração com Google Sheets ainda não configurada nesta plataforma. Peça ao administrador para
                adicionar <code>GOOGLE_CLIENT_ID</code>, <code>GOOGLE_CLIENT_SECRET</code> e{" "}
                <code>NEXT_PUBLIC_APP_URL</code> nas variáveis de ambiente (Google Cloud Console → APIs e serviços →
                Credenciais → ID do cliente OAuth 2.0, com o URI de redirecionamento{" "}
                <code>{"{NEXT_PUBLIC_APP_URL}"}/api/integrations/google-sheets/callback</code> autorizado).
              </AlertDescription>
            </Alert>
          ) : !conectado ? (
            <Button asChild className="self-start" data-guia="conexao_sheets">
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

              <FieldGroup>
                <FieldRow
                  label="Exportar automaticamente após cada busca"
                  description="Usa a planilha marcada como principal, no modo configurado."
                  control={<Switch checked={autoExport} onCheckedChange={setAutoExport} />}
                />
              </FieldGroup>

              <div className="flex flex-col gap-3">
                <FieldGroupLabel className="mb-0">Planilhas configuradas</FieldGroupLabel>
                {planilhas.length === 0 && (
                  <EmptyState icon={Sheet} title="Nenhuma planilha adicionada ainda" className="py-8" />
                )}
                {planilhas.map((p, i) => (
                  <div key={`${p.id}-${i}`} className="flex flex-col gap-2 rounded-xl border border-border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate text-sm font-medium">{p.nome}</span>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button type="button" variant={p.padrao ? "default" : "ghost"} size="sm" onClick={() => definirPadrao(i)}>
                          <Star className="h-3.5 w-3.5" /> {p.padrao ? "Principal" : "Definir como principal"}
                        </Button>
                        <Button aria-label="Remover" title="Remover" type="button" variant="ghost" size="icon" onClick={() => removerPlanilha(i)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Select value={p.aba} onValueChange={(v) => atualizarPlanilha(i, { aba: v })} onOpenChange={(open) => open && carregarAbas(p.id)}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(abasPorSheet[p.id] || [p.aba]).map((aba) => (
                            <SelectItem key={aba} value={aba}>{aba}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={p.modo} onValueChange={(v) => atualizarPlanilha(i, { modo: v as SheetConfig["modo"] })}>
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
                      {disponiveis.map((d) => {
                        const abasUsadas = planilhas.filter((p) => p.id === d.id).length;
                        return (
                          <SelectItem key={d.id} value={d.id}>
                            {d.name}{abasUsadas ? ` (já tem ${abasUsadas} aba${abasUsadas > 1 ? "s" : ""}; adicionar outra)` : ""}
                          </SelectItem>
                        );
                      })}
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
