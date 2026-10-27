"use client";

import { useState } from "react";
import { Plus, Trash2, RefreshCw, Send, FileText } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import type { BadgeProps } from "@/components/ui/badge";
import { useConfirm } from "@/components/ui/confirm-provider";
import { extrairParametrosTemplate, nomeMetaDe, problemasTemplate } from "@/lib/dispatch-template-shared";
import type { MessageTemplateRow, WhatsappInstanceRow } from "@/lib/database.types";

const STATUS_LABEL: Record<string, { label: string; variant: BadgeProps["variant"] }> = {
  rascunho: { label: "Rascunho", variant: "secondary" },
  pending: { label: "Em aprovação", variant: "outline" },
  approved: { label: "Aprovado", variant: "success" },
  rejected: { label: "Rejeitado", variant: "destructive" },
};

const CATEGORIAS: [string, string][] = [
  ["MARKETING", "Marketing (prospecção, ofertas, convites)"],
  ["UTILITY", "Utilidade (aviso sobre algo que o cliente já contratou)"],
];

export function TemplatesPanel({
  templatesIniciais,
  instanciasOficiais,
}: {
  templatesIniciais: MessageTemplateRow[];
  instanciasOficiais: WhatsappInstanceRow[];
}) {
  const confirmar = useConfirm();
  const [templates, setTemplates] = useState(templatesIniciais);
  const [instanceId, setInstanceId] = useState(instanciasOficiais[0]?.id ?? "");
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState("MARKETING");
  const [nomeMeta, setNomeMeta] = useState("");
  const [cabecalho, setCabecalho] = useState("");
  const [corpo, setCorpo] = useState("");
  const [rodape, setRodape] = useState("");
  const [exemplos, setExemplos] = useState<string[]>([]);
  const [exemploCabecalho, setExemploCabecalho] = useState("");
  const [tentouCriar, setTentouCriar] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [motivos, setMotivos] = useState<Record<string, string>>({});

  const parametros = extrairParametrosTemplate(corpo);
  const cabecalhoTemVariavel = extrairParametrosTemplate(cabecalho).length > 0;
  const nomeMetaFinal = nomeMeta.trim() || nomeMetaDe(nome);
  const problemas = problemasTemplate({ nomeMeta: nomeMetaFinal, corpo, cabecalho, rodape, exemplos, exemploCabecalho });
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function instanciaNome(id: string | null) {
    return instanciasOficiais.find((i) => i.id === id)?.nome ?? "—";
  }

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setTentouCriar(true);
    setAviso(null);
    if (!instanceId || !nome.trim() || problemas.length) return;
    setCreating(true);
    setError(null);
    const resp = await fetch("/api/dispatch/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instanceId, nome, categoria, corpo,
        nomeMeta: nomeMetaFinal, cabecalho: cabecalho || undefined, rodape: rodape || undefined,
        exemplos: exemplos.slice(0, parametros.length).map((x) => x.trim()),
        exemploCabecalho: cabecalhoTemVariavel ? exemploCabecalho.trim() : undefined,
      }),
    }).catch(() => null);
    const data = await resp?.json().catch(() => ({}));
    setCreating(false);
    if (!resp?.ok) {
      setError(data?.error || "Não foi possível criar o template.");
      return;
    }
    if (data.aviso) setAviso(`Template salvo, mas a Meta recusou o envio: ${data.aviso} Ajuste e clique em “Enviar p/ aprovação”, ou remova e crie de novo.`);
    setTentouCriar(false);
    setNome("");
    setNomeMeta("");
    setCabecalho("");
    setCorpo("");
    setRodape("");
    setExemplos([]);
    setExemploCabecalho("");
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
    if (data.motivo) setMotivos((m) => ({ ...m, [id]: data.motivo }));
  }

  async function remover(id: string) {
    if (!(await confirmar({ title: "Remover este template?", destructive: true }))) return;
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
        {aviso && <Alert><AlertDescription>{aviso}</AlertDescription></Alert>}

        {instanciasOficiais.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma instância do canal oficial conectada ainda — templates só se aplicam a esse canal.
          </p>
        ) : (
          <>
            {templates.length === 0 && <EmptyState icon={FileText} title="Nenhum template criado ainda" className="py-8" />}

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
                  {t.status_aprovacao === "rejected" && (
                    <p className="text-xs text-destructive">
                      A Meta reprovou este template{motivos[t.id] ? ` (${motivos[t.id]})` : ""}. Remova e crie de novo com o texto ajustado e outro nome.
                    </p>
                  )}
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
                      {CATEGORIAS.map(([valor, rotulo]) => (
                        <SelectItem key={valor} value={valor}>{rotulo}</SelectItem>
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
                  <Label htmlFor="tpl-nome-meta">Nome na Meta <span className="font-normal text-muted-2">(automático)</span></Label>
                  <Input
                    id="tpl-nome-meta"
                    value={nomeMeta}
                    onChange={(e) => setNomeMeta(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))}
                    placeholder={nome ? nomeMetaDe(nome) : "gerado a partir do nome"}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tpl-cabecalho">Cabeçalho (opcional)</Label>
                <Input id="tpl-cabecalho" value={cabecalho} onChange={(e) => setCabecalho(e.target.value)} maxLength={60} />
                {cabecalhoTemVariavel && (
                  <Input value={exemploCabecalho} onChange={(e) => setExemploCabecalho(e.target.value)} placeholder="Exemplo para o {{1}} do cabeçalho" aria-label="Exemplo da variável do cabeçalho" />
                )}
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
                <p className="text-xs text-muted-foreground">
                  Use {"{{1}}"}, {"{{2}}"}… onde entram dados do lead (nome, empresa…). O que vai em cada número você escolhe na etapa da campanha.
                </p>
              </div>
              {parametros.length > 0 && (
                <div className="flex flex-col gap-2 rounded-xl bg-secondary/40 p-3">
                  <p className="text-xs font-medium text-foreground">
                    Exemplos para a análise da Meta <span className="font-normal text-muted-foreground">(obrigatório: um valor de exemplo para cada variável)</span>
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {parametros.map((n, i) => (
                      <div key={n} className="flex items-center gap-2">
                        <span className="w-10 shrink-0 font-mono text-xs text-muted-foreground">{`{{${n}}}`}</span>
                        <Input
                          value={exemplos[i] ?? ""}
                          onChange={(e) => setExemplos((ex) => { const novo = [...ex]; novo[i] = e.target.value; return novo; })}
                          placeholder={i === 0 ? "Ex.: Mariana" : i === 1 ? "Ex.: Clínica Sorriso" : "Ex.: valor"}
                          aria-label={`Exemplo para {{${n}}}`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tpl-rodape">Rodapé (opcional)</Label>
                <Input id="tpl-rodape" value={rodape} onChange={(e) => setRodape(e.target.value)} maxLength={60} />
              </div>
              {tentouCriar && (problemas.length > 0 || !nome.trim()) && (
                <ul className="flex flex-col gap-1 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-foreground">
                  {!nome.trim() && <li>Dê um nome interno ao template.</li>}
                  {problemas.map((p) => <li key={p}>{p}</li>)}
                </ul>
              )}
              <Button type="submit" disabled={creating} className="self-start">
                <Plus className="h-4 w-4" /> {creating ? "Enviando…" : "Criar e enviar para aprovação"}
              </Button>
            </form>
          </>
        )}
      </CardContent>
    </Card>
  );
}
