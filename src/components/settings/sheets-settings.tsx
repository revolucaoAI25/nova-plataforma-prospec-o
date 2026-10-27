"use client";

import { useEffect, useState } from "react";
import { Sheet, Link2, Unlink, Star, Trash2, FolderOpen, FilePlus2, Loader2, AlertTriangle } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { FieldGroup, FieldRow, FieldGroupLabel } from "@/components/ui/field-group";
import { useConfirm } from "@/components/ui/confirm-provider";
import { Input } from "@/components/ui/input";
import { criarPlanilhaNova, escolherPlanilhaNoGoogle, type PlanilhaEscolhida } from "@/components/sheets/seletor-google";
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
  const [abasPorSheet, setAbasPorSheet] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);
  // Planilhas configuradas que a plataforma não consegue abrir (com o acesso novo, só as escolhidas no seletor do Google).
  const [semAcesso, setSemAcesso] = useState<Record<string, boolean>>({});
  const [ocupado, setOcupado] = useState<"escolher" | "criar" | null>(null);
  const [criando, setCriando] = useState(false);
  const [titulo, setTitulo] = useState("Leads Leadmatic");
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(
    initialFeedback === "conectado"
      ? { ok: true, msg: "Conta Google conectada com sucesso." }
      : initialFeedback === "nao_configurado"
        ? { ok: false, msg: "A integração com o Google Sheets ainda não está disponível. Fale com o suporte para ativar." }
        : initialFeedback === "erro"
          ? { ok: false, msg: "Não foi possível conectar sua conta Google." }
          : null,
  );

  /** Abas da planilha (e se a plataforma tem acesso a ela). */
  async function buscarAbas(sheetId: string): Promise<string[]> {
    const resp = await fetch(`/api/integrations/google-sheets/spreadsheets?sheetId=${encodeURIComponent(sheetId)}`).catch(() => null);
    const data = await resp?.json().catch(() => null);
    setSemAcesso((prev) => ({ ...prev, [sheetId]: Boolean(!resp?.ok && data?.semAcesso) }));
    const abas = resp?.ok ? ((data?.abas as string[] | undefined) ?? []) : [];
    if (resp?.ok) setAbasPorSheet((prev) => ({ ...prev, [sheetId]: abas }));
    return abas;
  }

  // Confere uma vez se as planilhas já configuradas continuam acessíveis.
  useEffect(() => {
    if (!conectado) return;
    const ids = [...new Set((profile.google_sheets_creds?.planilhas || []).map((p) => p.id))];
    let ativo = true;
    for (const id of ids) {
      fetch(`/api/integrations/google-sheets/spreadsheets?sheetId=${encodeURIComponent(id)}`)
        .then(async (r) => ({ ok: r.ok, d: await r.json().catch(() => null) }))
        .then(({ ok, d }) => {
          if (!ativo) return;
          setSemAcesso((prev) => ({ ...prev, [id]: Boolean(!ok && d?.semAcesso) }));
          if (ok) setAbasPorSheet((prev) => ({ ...prev, [id]: d?.abas ?? [] }));
        })
        .catch(() => undefined);
    }
    return () => { ativo = false; };
  }, [conectado, profile.google_sheets_creds?.planilhas]);

  async function carregarAbas(sheetId: string) {
    if (abasPorSheet[sheetId]) return;
    await buscarAbas(sheetId);
  }

  async function escolherNoGoogle(arquivoId?: string) {
    setFeedback(null);
    setOcupado("escolher");
    try {
      const p = await escolherPlanilhaNoGoogle({ arquivoId });
      if (!p) return;
      if (arquivoId) {
        // Liberou uma planilha já configurada: só recarrega as abas.
        await buscarAbas(p.id);
      } else {
        await adicionarPlanilha(p);
      }
    } catch (e) {
      setFeedback({ ok: false, msg: (e as Error).message });
    } finally {
      setOcupado(null);
    }
  }

  async function criarNova() {
    if (!titulo.trim()) return;
    setFeedback(null);
    setOcupado("criar");
    try {
      const p = await criarPlanilhaNova(titulo.trim());
      setAbasPorSheet((prev) => ({ ...prev, [p.id]: p.abas }));
      setCriando(false);
      await adicionarPlanilha({ id: p.id, name: p.name }, p.abas);
      setFeedback({ ok: true, msg: `Planilha "${p.name}" criada no seu Google Drive e adicionada.` });
    } catch (e) {
      setFeedback({ ok: false, msg: (e as Error).message });
    } finally {
      setOcupado(null);
    }
  }

  // A mesma planilha pode entrar mais de uma vez, uma por aba: cada linha
  // é planilha + aba (as operações abaixo usam a posição na lista, não o id
  // da planilha, que se repete).
  // Escolhida no Google: já entra salva (sem depender de lembrar do botão Salvar).
  async function adicionarPlanilha(p: PlanilhaEscolhida, abasConhecidas?: string[]) {
    const abas = abasConhecidas ?? abasPorSheet[p.id] ?? (await buscarAbas(p.id));
    const usadas = new Set(planilhas.filter((x) => x.id === p.id).map((x) => x.aba));
    const aba = abas.find((a) => !usadas.has(a)) ?? abas[0] ?? "Planilha1";
    const nova = [...planilhas, { id: p.id, nome: p.name, aba, modo: "acrescentar" as const, padrao: planilhas.length === 0 }];
    setPlanilhas(nova);
    const resp = await fetch("/api/integrations/google-sheets/config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planilhas: nova, autoExport }),
    }).catch(() => null);
    setFeedback(resp?.ok ? { ok: true, msg: `Planilha "${p.name}" adicionada.` } : { ok: false, msg: "A planilha entrou na lista, mas não foi salva. Clique em Salvar." });
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
                A integração com o Google Sheets ainda não está disponível. Fale com o suporte para ativar.
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
                    {semAcesso[p.id] && (
                      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-foreground">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                        <span className="min-w-0 flex-1">A plataforma não tem acesso a esta planilha. Libere escolhendo-a no Google Drive (uma vez só).</span>
                        <Button type="button" size="sm" variant="outline" onClick={() => escolherNoGoogle(p.id)} disabled={ocupado !== null}>
                          Liberar acesso
                        </Button>
                      </div>
                    )}
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

                <div className="flex flex-col gap-2 rounded-xl border border-dashed border-border p-4">
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" onClick={() => escolherNoGoogle()} disabled={ocupado !== null}>
                      {ocupado === "escolher" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderOpen className="h-4 w-4" />} Adicionar planilha do Google Drive
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setCriando((v) => !v)} disabled={ocupado !== null}>
                      <FilePlus2 className="h-4 w-4" /> Criar planilha nova
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Abre a janela do Google com as suas planilhas (dá para buscar pelo nome). A plataforma só acessa as planilhas que você escolher.
                  </p>
                {criando && (
                  <div className="flex gap-2">
                    <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} aria-label="Nome da planilha nova" maxLength={120} />
                    <Button type="button" size="sm" onClick={criarNova} disabled={!titulo.trim() || ocupado !== null} className="h-10 shrink-0">
                      {ocupado === "criar" && <Loader2 className="h-4 w-4 animate-spin" />} Criar
                    </Button>
                  </div>
                )}
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
