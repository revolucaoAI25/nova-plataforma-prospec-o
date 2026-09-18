"use client";

import { useState } from "react";
import { Plus, Trash2, RefreshCw, Send, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import type { BadgeProps } from "@/components/ui/badge";
import type { MessageTemplateRow, WhatsappInstanceRow } from "@/lib/database.types";

const STATUS_LABEL: Record<string, { label: string; variant: BadgeProps["variant"] }> = {
  rascunho: { label: "Rascunho", variant: "secondary" },
  pending: { label: "Em aprovação", variant: "outline" },
  approved: { label: "Aprovado", variant: "success" },
  rejected: { label: "Rejeitado", variant: "destructive" },
};

const CATEGORIAS = ["MARKETING", "UTILITY", "AUTHENTICATION"];

export function TemplatesPanel({
  templatesIniciais,
  instanciasOficiais,
}: {
  templatesIniciais: MessageTemplateRow[];
  instanciasOficiais: WhatsappInstanceRow[];
}) {
  const [templates, setTemplates] = useState(templatesIniciais);
  const [instanceId, setInstanceId] = useState(instanciasOficiais[0]?.id ?? "");
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState("MARKETING");
  const [nomeMeta, setNomeMeta] = useState("");
  const [cabecalho, setCabecalho] = useState("");
  const [corpo, setCorpo] = useState("");
  const [rodape, setRodape] = useState("");
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function instanciaNome(id: string | null) {
    return instanciasOficiais.find((i) => i.id === id)?.nome ?? "—";
  }

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    if (!instanceId || !nome.trim() || !corpo.trim()) return;
    setCreating(true);
    setError(null);
    const resp = await fetch("/api/dispatch/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instanceId, nome, categoria, corpo, nomeMeta: nomeMeta || undefined, cabecalho: cabecalho || undefined, rodape: rodape || undefined }),
    });
    const data = await resp.json();
    setCreating(false);
    if (!resp.ok) {
      setError(data.error || "Não foi possível criar o template.");
      return;
    }
    setNome("");
    setNomeMeta("");
    setCabecalho("");
    setCorpo("");
    setRodape("");
    const listResp = await fetch("/api/dispatch/templates");
    const listData = await listResp.json();
    setTemplates(listData.templates || []);
  }

  async function enviarParaAprovacao(id: string) {
    setBusyId(id);
    setError(null);
    const resp = await fetch(`/api/dispatch/templates/${id}`, { method: "PATCH" });
    const data = await resp.json();
    setBusyId(null);
    if (!resp.ok) {
      setError(data.error || "Não foi possível enviar para aprovação.");
      return;
    }
    setTemplates((prev) => prev.map((t) => (t.id === id ? { ...t, status_aprovacao: "pending" } : t)));
  }

  async function verificarStatus(id: string) {
    setBusyId(id);
    const resp = await fetch(`/api/dispatch/templates/${id}`);
    const data = await resp.json();
    setBusyId(null);
    if (data.template) setTemplates((prev) => prev.map((t) => (t.id === id ? data.template : t)));
  }

  async function remover(id: string) {
    if (!confirm("Remover este template?")) return;
    await fetch(`/api/dispatch/templates/${id}`, { method: "DELETE" });
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><FileText className="h-4 w-4 text-primary" /> Templates de mensagem</CardTitle>
        <CardDescription>
          O canal oficial (WhatsApp Business Cloud API) exige templates pré-aprovados pela Meta para iniciar
          conversas. Crie aqui, envie para aprovação e use nas etapas de cadência de uma campanha oficial.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

        {instanciasOficiais.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma instância do canal oficial conectada ainda — templates só se aplicam a esse canal.
          </p>
        ) : (
          <>
            {templates.length === 0 && <p className="text-sm text-muted-foreground">Nenhum template criado ainda.</p>}

            {templates.map((t) => {
              const status = STATUS_LABEL[t.status_aprovacao] ?? { label: t.status_aprovacao, variant: "outline" as const };
              return (
                <div key={t.id} className="flex flex-col gap-2 rounded-xl border border-border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate font-medium">{t.nome}</span>
                      <Badge variant="outline">{t.categoria}</Badge>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {t.status_aprovacao === "rascunho" && (
                        <Button type="button" variant="ghost" size="sm" onClick={() => enviarParaAprovacao(t.id)} disabled={busyId === t.id}>
                          <Send className="h-3.5 w-3.5" /> Enviar p/ aprovação
                        </Button>
                      )}
                      {t.meta_template_id && (
                        <Button type="button" variant="ghost" size="icon" onClick={() => verificarStatus(t.id)} disabled={busyId === t.id} title="Verificar status na Meta">
                          <RefreshCw className={busyId === t.id ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
                        </Button>
                      )}
                      <Button type="button" variant="ghost" size="icon" onClick={() => remover(t.id)} title="Remover">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Instância: {instanciaNome(t.instance_id)} · Idioma: {t.idioma || "pt_BR"}
                    {t.nome_meta ? ` · Nome na Meta: ${t.nome_meta}` : ""}
                  </p>
                  <p className="whitespace-pre-wrap text-sm">{t.corpo}</p>
                </div>
              );
            })}

            <form onSubmit={criar} className="flex flex-col gap-3 rounded-xl border border-dashed border-border p-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label>Instância oficial</Label>
                  <Select value={instanceId} onValueChange={setInstanceId}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {instanciasOficiais.map((i) => (
                        <SelectItem key={i.id} value={i.id}>{i.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Categoria</Label>
                  <Select value={categoria} onValueChange={setCategoria}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIAS.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="tpl-nome">Nome interno</Label>
                  <Input id="tpl-nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Boas-vindas" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="tpl-nome-meta">Nome na Meta (minúsculo_com_underscore)</Label>
                  <Input id="tpl-nome-meta" value={nomeMeta} onChange={(e) => setNomeMeta(e.target.value)} placeholder="boas_vindas_v1" />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tpl-cabecalho">Cabeçalho (opcional)</Label>
                <Input id="tpl-cabecalho" value={cabecalho} onChange={(e) => setCabecalho(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tpl-corpo">Corpo</Label>
                <Textarea
                  id="tpl-corpo"
                  value={corpo}
                  onChange={(e) => setCorpo(e.target.value)}
                  placeholder="Olá {{1}}, tudo bem? …"
                  rows={3}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tpl-rodape">Rodapé (opcional)</Label>
                <Input id="tpl-rodape" value={rodape} onChange={(e) => setRodape(e.target.value)} />
              </div>
              <Button type="submit" disabled={creating} className="self-start">
                <Plus className="h-4 w-4" /> {creating ? "Criando…" : "Criar template"}
              </Button>
            </form>
          </>
        )}
      </CardContent>
    </Card>
  );
}
