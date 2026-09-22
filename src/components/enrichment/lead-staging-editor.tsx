"use client";

import { useRef, useState } from "react";
import { Plus, Trash2, Upload, ClipboardPaste } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { parseLeadsColados } from "@/lib/lead-enrichment-shared";

export interface LeadStaged {
  nome: string;
  email: string;
  telefone: string;
}

const CANDIDATOS_NOME = ["nome", "name", "full name", "empresa", "contato"];
const CANDIDATOS_EMAIL = ["email", "e-mail", "mail"];
const CANDIDATOS_TEL = ["telefone", "phone", "celular", "whatsapp", "fone", "numero", "número"];

function detectarCol(colunas: string[], candidatos: string[], padrao: number): number {
  const idx = colunas.findIndex((c) => candidatos.some((k) => c.toLowerCase().includes(k)));
  return idx >= 0 ? idx : padrao;
}

export function LeadStagingEditor({ leads, onChange }: { leads: LeadStaged[]; onChange: (leads: LeadStaged[]) => void }) {
  const [texto, setTexto] = useState("");
  const [textoAviso, setTextoAviso] = useState<string | null>(null);
  const [uploadAviso, setUploadAviso] = useState<string | null>(null);
  const [uploadRows, setUploadRows] = useState<Record<string, string>[] | null>(null);
  const [uploadCols, setUploadCols] = useState<string[]>([]);
  const [colNome, setColNome] = useState("");
  const [colEmail, setColEmail] = useState("");
  const [colTel, setColTel] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function adicionarDeTexto() {
    const novos = parseLeadsColados(texto);
    if (!novos.length) {
      setTextoAviso("Não reconheci nenhum lead nesse texto — confira o formato.");
      return;
    }
    onChange([...leads, ...novos]);
    setTexto("");
    setTextoAviso(null);
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    setUploading(true);
    setUploadAviso(null);
    const form = new FormData();
    form.append("arquivo", arquivo);
    const resp = await fetch("/api/enrichment/parse-upload", { method: "POST", body: form });
    const data = await resp.json();
    setUploading(false);
    if (!resp.ok) {
      setUploadAviso(data.error || "Não foi possível ler o arquivo.");
      return;
    }
    const cols: string[] = data.colunas;
    setUploadCols(cols);
    setUploadRows(data.rows);
    setColNome(cols[detectarCol(cols, CANDIDATOS_NOME, 0)] ?? cols[0] ?? "");
    setColEmail(cols[detectarCol(cols, CANDIDATOS_EMAIL, Math.min(1, cols.length - 1))] ?? "");
    setColTel(cols[detectarCol(cols, CANDIDATOS_TEL, Math.min(2, cols.length - 1))] ?? "");
  }

  function adicionarDeUpload() {
    if (!uploadRows) return;
    const novos = uploadRows
      .map((r) => ({ nome: r[colNome] || "", email: r[colEmail] || "", telefone: r[colTel] || "" }))
      .filter((l) => l.email.trim() || l.telefone.trim());
    onChange([...leads, ...novos]);
    setUploadRows(null);
    setUploadCols([]);
    if (fileRef.current) fileRef.current.value = "";
  }

  function atualizarLinha(idx: number, campo: keyof LeadStaged, valor: string) {
    onChange(leads.map((l, i) => (i === idx ? { ...l, [campo]: valor } : l)));
  }

  function removerLinha(idx: number) {
    onChange(leads.filter((_, i) => i !== idx));
  }

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Monte a lista de leads</CardTitle>
          <CardDescription>Cole um lead por bloco (rótulo + valor) ou uma linha por lead, ou envie uma planilha.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label className="flex items-center gap-1.5"><ClipboardPaste className="h-3.5 w-3.5" /> Colar texto</Label>
              <Textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                rows={6}
                placeholder={
                  '* Email\nfulano@empresa.com.br\n* Full name\nFulano de Tal\n* Phone number\n+5511999999999\n\nou\n\n' +
                  "Fulano de Tal, fulano@empresa.com.br, 11999999999"
                }
              />
              {textoAviso && <p className="text-xs text-destructive">{textoAviso}</p>}
              <Button type="button" variant="outline" size="sm" onClick={adicionarDeTexto} disabled={!texto.trim()} className="self-start">
                <Plus className="h-3.5 w-3.5" /> Adicionar à lista
              </Button>
            </div>

            <div className="flex flex-col gap-2">
              <Label className="flex items-center gap-1.5"><Upload className="h-3.5 w-3.5" /> Upload de planilha (CSV ou XLSX)</Label>
              <Input ref={fileRef} type="file" accept=".csv,.xlsx" onChange={handleUpload} disabled={uploading} />
              {uploadAviso && <p className="text-xs text-destructive">{uploadAviso}</p>}
              {uploading && <p className="text-xs text-muted-foreground">Lendo arquivo…</p>}
              {uploadRows && uploadCols.length > 0 && (
                <div className="flex flex-col gap-2 rounded-xl border border-dashed border-border p-3">
                  <p className="text-xs text-muted-foreground">{uploadRows.length} linha(s) — confira as colunas detectadas:</p>
                  <div className="grid grid-cols-3 gap-2">
                    <Select value={colNome} onValueChange={setColNome}>
                      <SelectTrigger className="h-8"><SelectValue placeholder="Nome" /></SelectTrigger>
                      <SelectContent>{uploadCols.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={colEmail} onValueChange={setColEmail}>
                      <SelectTrigger className="h-8"><SelectValue placeholder="E-mail" /></SelectTrigger>
                      <SelectContent>{uploadCols.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={colTel} onValueChange={setColTel}>
                      <SelectTrigger className="h-8"><SelectValue placeholder="Telefone" /></SelectTrigger>
                      <SelectContent>{uploadCols.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={adicionarDeUpload} className="self-start">
                    <Plus className="h-3.5 w-3.5" /> Adicionar à lista
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">2. Revise a lista</CardTitle>
          <CardDescription>Dá pra editar ou apagar linhas direto na tabela.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {leads.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum lead na lista ainda — cole texto ou envie uma planilha acima.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((l, i) => (
                  <TableRow key={i}>
                    <TableCell><Input className="h-8" value={l.nome} onChange={(e) => atualizarLinha(i, "nome", e.target.value)} /></TableCell>
                    <TableCell><Input className="h-8" value={l.email} onChange={(e) => atualizarLinha(i, "email", e.target.value)} /></TableCell>
                    <TableCell><Input className="h-8" value={l.telefone} onChange={(e) => atualizarLinha(i, "telefone", e.target.value)} /></TableCell>
                    <TableCell>
                      <Button type="button" variant="ghost" size="icon" onClick={() => removerLinha(i)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {leads.length > 50 && (
            <Alert variant="info">
              <AlertDescription>Lista tem {leads.length} leads — só os primeiros 50 serão processados por vez (rode de novo pro restante depois).</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
