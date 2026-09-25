"use client";

import { useState } from "react";
import { Plus, Trash2, FileText } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { EmailTemplateRow } from "@/lib/database.types";

export function TemplatesPanel({ templatesIniciais }: { templatesIniciais: EmailTemplateRow[] }) {
  const [templates, setTemplates] = useState(templatesIniciais);
  const [nome, setNome] = useState("");
  const [assunto, setAssunto] = useState("");
  const [corpo, setCorpo] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim() || !assunto.trim() || !corpo.trim()) return;
    setCreating(true);
    setError(null);
    const resp = await fetch("/api/email-dispatch/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, assunto, corpo }),
    });
    const data = await resp.json();
    setCreating(false);
    if (!resp.ok) {
      setError(data.error || "Não foi possível criar o template.");
      return;
    }
    setNome("");
    setAssunto("");
    setCorpo("");
    const listResp = await fetch("/api/email-dispatch/templates");
    const listData = await listResp.json();
    setTemplates(listData.templates || []);
  }

  async function remover(id: string) {
    if (!confirm("Remover este template?")) return;
    await fetch(`/api/email-dispatch/templates/${id}`, { method: "DELETE" });
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><FileText className="h-4 w-4 text-primary" /> Templates de e-mail</CardTitle>
        <CardDescription>Assunto e corpo prontos pra reaproveitar ao montar uma etapa de cadência.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

        {templates.length === 0 && <EmptyState icon={FileText} title="Nenhum template criado ainda" className="py-8" />}

        {templates.map((t) => (
          <div key={t.id} className="flex flex-col gap-2 rounded-xl border border-border p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-medium">{t.nome}</span>
              <Button type="button" variant="ghost" size="icon" onClick={() => remover(t.id)} title="Remover">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Assunto: {t.assunto}</p>
            <p className="whitespace-pre-wrap text-sm">{t.corpo}</p>
          </div>
        ))}

        <form onSubmit={criar} className="flex flex-col gap-3 rounded-xl border border-dashed border-border p-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tpl-nome">Nome interno</Label>
            <Input id="tpl-nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Boas-vindas" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tpl-assunto">Assunto</Label>
            <Input id="tpl-assunto" value={assunto} onChange={(e) => setAssunto(e.target.value)} placeholder="Olá {{nome}}, tudo bem?" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tpl-corpo">Corpo</Label>
            <Textarea
              id="tpl-corpo"
              value={corpo}
              onChange={(e) => setCorpo(e.target.value)}
              placeholder="Use {{nome}}, {{email}}, {{municipio}}… pra puxar dados do lead"
              rows={4}
            />
          </div>
          <Button type="submit" disabled={creating} className="self-start">
            <Plus className="h-4 w-4" /> {creating ? "Criando…" : "Criar template"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
