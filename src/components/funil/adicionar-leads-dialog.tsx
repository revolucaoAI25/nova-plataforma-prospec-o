"use client";

import { useRef, useState } from "react";
import { Plus, Trash2, Upload, ClipboardPaste, History, UserPlus, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import type { SearchRow, LeadRow } from "@/lib/database.types";

interface LeadStaged {
  nome: string;
  telefone: string;
  email: string;
  empresa: string;
}

const VAZIO: LeadStaged = { nome: "", telefone: "", email: "", empresa: "" };

/** Aceita nome/telefone/email/empresa por linha, em qualquer ordem entre vírgula/tab/;. */
function parseLinhasColadas(texto: string): LeadStaged[] {
  const itens: LeadStaged[] = [];
  for (const linhaBruta of (texto || "").split("\n")) {
    const linha = linhaBruta.trim();
    if (!linha) continue;
    const partes = linha.split(/[,;\t]/).map((p) => p.trim()).filter(Boolean);
    const item = { ...VAZIO };
    for (const p of partes) {
      if (p.includes("@") && !item.email) item.email = p;
      else if (/\d{8,}/.test(p.replace(/\D/g, "")) && !item.telefone) item.telefone = p;
      else if (!item.nome) item.nome = p;
      else if (!item.empresa) item.empresa = p;
    }
    if (item.nome || item.telefone || item.email) itens.push(item);
  }
  return itens;
}

const CANDIDATOS_NOME = ["nome", "name"];
const CANDIDATOS_TEL = ["telefone", "phone", "celular", "whatsapp"];
const CANDIDATOS_EMAIL = ["email", "e-mail"];
const CANDIDATOS_EMPRESA = ["empresa", "razao social", "razão social", "company"];

function detectarCol(colunas: string[], candidatos: string[]): string {
  return colunas.find((c) => candidatos.some((k) => c.toLowerCase().includes(k))) ?? "";
}

/**
 * Painel de adicionar leads a uma coluna do Funil — 4 formas, mesma
 * arquitetura do BigDataCorpLeadStagingEditor: 1 lead avulso (some
 * direto), colar texto / upload de planilha (acumula numa lista editável
 * antes de enviar em lote) e puxar de uma pesquisa do histórico inteira.
 */
export function AdicionarLeadsDialog({
  funilId,
  colunaId,
  colunaNome,
  onAdicionado,
  onFechar,
}: {
  funilId: string;
  colunaId: string;
  colunaNome: string;
  onAdicionado: () => void;
  onFechar: () => void;
}) {
  const [leads, setLeads] = useState<LeadStaged[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [individual, setIndividual] = useState<LeadStaged>(VAZIO);
  const [addingIndividual, setAddingIndividual] = useState(false);

  const [texto, setTexto] = useState("");
  const [textoAviso, setTextoAviso] = useState<string | null>(null);

  const [uploadAviso, setUploadAviso] = useState<string | null>(null);
  const [uploadRows, setUploadRows] = useState<Record<string, string>[] | null>(null);
  const [uploadCols, setUploadCols] = useState<string[]>([]);
  const [colNome, setColNome] = useState("");
  const [colTelefone, setColTelefone] = useState("");
  const [colEmail, setColEmail] = useState("");
  const [colEmpresa, setColEmpresa] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [pesquisas, setPesquisas] = useState<SearchRow[] | null>(null);
  const [pesquisaEscolhida, setPesquisaEscolhida] = useState("");
  const [carregandoHistorico, setCarregandoHistorico] = useState(false);

  async function enviarLeads(itens: LeadStaged[]): Promise<boolean> {
    setErro(null);
    const resp = await fetch(`/api/funis/${funilId}/cards`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ colunaId, leads: itens }),
    });
    const data = await resp.json();
    if (!resp.ok) {
      setErro(data.error || "Não foi possível adicionar os leads.");
      return false;
    }
    return true;
  }

  async function adicionarIndividual() {
    if (!individual.nome.trim() && !individual.telefone.trim() && !individual.email.trim()) return;
    setAddingIndividual(true);
    const ok = await enviarLeads([individual]);
    setAddingIndividual(false);
    if (ok) {
      setIndividual(VAZIO);
      onAdicionado();
    }
  }

  function adicionarDeTexto() {
    const novos = parseLinhasColadas(texto);
    if (!novos.length) {
      setTextoAviso("Não reconheci nenhum lead nesse texto — confira o formato (nome, telefone, email por linha).");
      return;
    }
    setLeads((prev) => [...prev, ...novos]);
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
    setColNome(detectarCol(cols, CANDIDATOS_NOME) || cols[0] || "");
    setColTelefone(detectarCol(cols, CANDIDATOS_TEL));
    setColEmail(detectarCol(cols, CANDIDATOS_EMAIL));
    setColEmpresa(detectarCol(cols, CANDIDATOS_EMPRESA));
  }

  function adicionarDeUpload() {
    if (!uploadRows) return;
    const novos = uploadRows.map((r) => ({
      nome: r[colNome] || "",
      telefone: r[colTelefone] || "",
      email: r[colEmail] || "",
      empresa: r[colEmpresa] || "",
    }));
    setLeads((prev) => [...prev, ...novos]);
    setUploadRows(null);
    setUploadCols([]);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function carregarPesquisas() {
    if (pesquisas) return;
    const resp = await fetch("/api/historico");
    const data = await resp.json();
    if (resp.ok) setPesquisas(data.pesquisas as SearchRow[]);
  }

  async function adicionarDoHistorico() {
    if (!pesquisaEscolhida) return;
    setCarregandoHistorico(true);
    setErro(null);
    const resp = await fetch(`/api/historico/${pesquisaEscolhida}/leads`);
    const data = await resp.json();
    if (!resp.ok) {
      setCarregandoHistorico(false);
      setErro(data.error || "Não foi possível buscar os leads dessa pesquisa.");
      return;
    }
    const novos = (data.leads as LeadRow[]).map((l) => ({
      nome: l.nome || "",
      telefone: l.telefone || "",
      email: l.email || "",
      empresa: "",
    }));
    const enviouOk = await enviarLeads(novos);
    setCarregandoHistorico(false);
    if (enviouOk) onAdicionado();
  }

  function atualizarLinha(idx: number, campo: keyof LeadStaged, valor: string) {
    setLeads((prev) => prev.map((l, i) => (i === idx ? { ...l, [campo]: valor } : l)));
  }

  function removerLinha(idx: number) {
    setLeads((prev) => prev.filter((_, i) => i !== idx));
  }

  async function enviarLote() {
    if (!leads.length) return;
    setEnviando(true);
    const ok = await enviarLeads(leads);
    setEnviando(false);
    if (ok) {
      setLeads([]);
      onAdicionado();
    }
  }

  return (
    <Card className="border-primary/30">
      <CardHeader className="flex-row items-start justify-between gap-2">
        <div>
          <CardTitle className="text-base">Adicionar leads — {colunaNome}</CardTitle>
          <CardDescription>Um lead avulso, colar texto, upload de planilha, ou puxar de uma pesquisa do histórico.</CardDescription>
        </div>
        <Button variant="ghost" size="icon" onClick={onFechar}><X className="h-4 w-4" /></Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {erro && <Alert variant="destructive"><AlertDescription>{erro}</AlertDescription></Alert>}

        <Tabs defaultValue="individual" onValueChange={(v) => v === "historico" && carregarPesquisas()}>
          <TabsList>
            <TabsTrigger value="individual"><UserPlus className="h-3.5 w-3.5" /> 1 lead</TabsTrigger>
            <TabsTrigger value="texto"><ClipboardPaste className="h-3.5 w-3.5" /> Colar texto</TabsTrigger>
            <TabsTrigger value="upload"><Upload className="h-3.5 w-3.5" /> Upload de planilha</TabsTrigger>
            <TabsTrigger value="historico"><History className="h-3.5 w-3.5" /> Do histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="individual" className="flex flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="lead-nome">Nome</Label>
                <Input id="lead-nome" value={individual.nome} onChange={(e) => setIndividual((p) => ({ ...p, nome: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="lead-empresa">Empresa</Label>
                <Input id="lead-empresa" value={individual.empresa} onChange={(e) => setIndividual((p) => ({ ...p, empresa: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="lead-telefone">Telefone</Label>
                <Input id="lead-telefone" value={individual.telefone} onChange={(e) => setIndividual((p) => ({ ...p, telefone: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="lead-email">E-mail</Label>
                <Input id="lead-email" type="email" value={individual.email} onChange={(e) => setIndividual((p) => ({ ...p, email: e.target.value }))} />
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={adicionarIndividual}
              disabled={addingIndividual || (!individual.nome.trim() && !individual.telefone.trim() && !individual.email.trim())}
              className="self-start"
            >
              <Plus className="h-3.5 w-3.5" /> {addingIndividual ? "Adicionando…" : "Adicionar card"}
            </Button>
          </TabsContent>

          <TabsContent value="texto" className="flex flex-col gap-2">
            <Textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={5}
              placeholder={"João Silva, (11) 98888-7777, joao@empresa.com, Empresa LTDA"}
            />
            {textoAviso && <p className="text-xs text-destructive">{textoAviso}</p>}
            <Button type="button" variant="outline" size="sm" onClick={adicionarDeTexto} disabled={!texto.trim()} className="self-start">
              <Plus className="h-3.5 w-3.5" /> Adicionar à lista
            </Button>
          </TabsContent>

          <TabsContent value="upload" className="flex flex-col gap-3">
            <Input ref={fileRef} type="file" accept=".csv,.xlsx" onChange={handleUpload} disabled={uploading} />
            {uploadAviso && <p className="text-xs text-destructive">{uploadAviso}</p>}
            {uploading && <p className="text-xs text-muted-foreground">Lendo arquivo…</p>}
            {uploadRows && uploadCols.length > 0 && (
              <div className="flex flex-col gap-3 rounded-xl border border-dashed border-border p-3">
                <p className="text-xs text-muted-foreground">{uploadRows.length} linha(s) — confira as colunas detectadas:</p>
                <div className="grid grid-cols-2 gap-2">
                  <Select value={colNome} onValueChange={setColNome}>
                    <SelectTrigger className="h-8"><SelectValue placeholder="Nome" /></SelectTrigger>
                    <SelectContent>{uploadCols.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={colEmpresa} onValueChange={setColEmpresa}>
                    <SelectTrigger className="h-8"><SelectValue placeholder="Empresa (opcional)" /></SelectTrigger>
                    <SelectContent>{uploadCols.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={colTelefone} onValueChange={setColTelefone}>
                    <SelectTrigger className="h-8"><SelectValue placeholder="Telefone (opcional)" /></SelectTrigger>
                    <SelectContent>{uploadCols.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={colEmail} onValueChange={setColEmail}>
                    <SelectTrigger className="h-8"><SelectValue placeholder="E-mail (opcional)" /></SelectTrigger>
                    <SelectContent>{uploadCols.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={adicionarDeUpload} className="self-start">
                  <Plus className="h-3.5 w-3.5" /> Adicionar à lista
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="historico" className="flex flex-col gap-3">
            {pesquisas === null ? (
              <p className="text-xs text-muted-foreground">Carregando pesquisas…</p>
            ) : pesquisas.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma pesquisa no seu histórico ainda.</p>
            ) : (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <Select value={pesquisaEscolhida} onValueChange={setPesquisaEscolhida}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Escolha uma pesquisa" /></SelectTrigger>
                    <SelectContent>
                      {pesquisas.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {[p.nicho, p.localidade].filter(Boolean).join(" — ") || p.id} ({p.total_results} resultado(s), {new Date(p.created_at).toLocaleDateString("pt-BR")})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={adicionarDoHistorico} disabled={!pesquisaEscolhida || carregandoHistorico}>
                  <Plus className="h-3.5 w-3.5" /> {carregandoHistorico ? "Adicionando…" : "Adicionar pesquisa inteira"}
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {leads.length > 0 && (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((l, i) => (
                  <TableRow key={i}>
                    <TableCell><Input className="h-8" value={l.nome} onChange={(e) => atualizarLinha(i, "nome", e.target.value)} /></TableCell>
                    <TableCell><Input className="h-8" value={l.empresa} onChange={(e) => atualizarLinha(i, "empresa", e.target.value)} /></TableCell>
                    <TableCell><Input className="h-8" value={l.telefone} onChange={(e) => atualizarLinha(i, "telefone", e.target.value)} /></TableCell>
                    <TableCell><Input className="h-8" value={l.email} onChange={(e) => atualizarLinha(i, "email", e.target.value)} /></TableCell>
                    <TableCell>
                      <Button type="button" variant="ghost" size="icon" onClick={() => removerLinha(i)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex items-center gap-2">
              <Button type="button" onClick={enviarLote} disabled={enviando}>
                {enviando ? "Enviando…" : `Adicionar ${leads.length} card(s)`}
              </Button>
              <Badge variant="secondary">{leads.length} na lista</Badge>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
