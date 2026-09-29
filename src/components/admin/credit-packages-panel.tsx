"use client";

import { useState } from "react";
import { Coins, Save, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useConfirm } from "@/components/ui/confirm-provider";
import type { CreditPackageRow } from "@/lib/database.types";

function LinhaPacote({ pacote, onRemovido }: { pacote: CreditPackageRow; onRemovido: (id: string) => void }) {
  const confirmar = useConfirm();
  const [nome, setNome] = useState(pacote.nome);
  const [quantidade, setQuantidade] = useState(pacote.quantidade_creditos);
  const [preco, setPreco] = useState(pacote.preco_centavos / 100);
  const [ativo, setAtivo] = useState(pacote.ativo);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  async function salvar() {
    setSaving(true);
    const resp = await fetch("/api/admin/credit-packages", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: pacote.id, nome, quantidadeCreditos: quantidade, precoCentavos: Math.round(preco * 100) }),
    });
    setSaving(false);
    if (resp.ok) setDirty(false);
  }

  async function alternarAtivo(v: boolean) {
    setAtivo(v);
    await fetch("/api/admin/credit-packages", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: pacote.id, ativo: v }),
    });
  }

  async function remover() {
    if (!(await confirmar({ title: `Remover o pacote "${pacote.nome}"?`, destructive: true }))) return;
    const resp = await fetch("/api/admin/credit-packages", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: pacote.id }),
    });
    if (resp.ok) onRemovido(pacote.id);
  }

  return (
    <TableRow>
      <TableCell>
        <Input className="h-8 w-32" value={nome} onChange={(e) => { setNome(e.target.value); setDirty(true); }} />
      </TableCell>
      <TableCell>
        <Input
          type="number" min={1} className="h-8 w-24"
          value={quantidade}
          onChange={(e) => { setQuantidade(Number(e.target.value)); setDirty(true); }}
        />
      </TableCell>
      <TableCell>
        <Input
          type="number" min={0.01} step={0.01} className="h-8 w-24"
          value={preco}
          onChange={(e) => { setPreco(Number(e.target.value)); setDirty(true); }}
        />
      </TableCell>
      <TableCell>
        <Switch checked={ativo} onCheckedChange={alternarAtivo} />
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          <Button size="sm" variant={dirty ? "default" : "ghost"} disabled={!dirty || saving} onClick={salvar}>
            <Save className="h-3.5 w-3.5" /> {saving ? "Salvando…" : "Salvar"}
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={remover}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

/** CRUD dos pacotes de créditos avulsos — mesma filosofia do CreditCostsPanel: ajustar preço/quantidade aqui não exige deploy. */
export function CreditPackagesPanel({ pacotesIniciais }: { pacotesIniciais: CreditPackageRow[] }) {
  const [pacotes, setPacotes] = useState(pacotesIniciais);
  const [novoNome, setNovoNome] = useState("");
  const [novaQuantidade, setNovaQuantidade] = useState("");
  const [novoPreco, setNovoPreco] = useState("");
  const [criando, setCriando] = useState(false);

  async function criar() {
    if (!novoNome.trim() || !novaQuantidade || !novoPreco) return;
    setCriando(true);
    const resp = await fetch("/api/admin/credit-packages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: novoNome.trim(),
        quantidadeCreditos: Number(novaQuantidade),
        precoCentavos: Math.round(Number(novoPreco) * 100),
        ordem: pacotes.length,
      }),
    });
    setCriando(false);
    if (!resp.ok) return;
    const data = await resp.json();
    setPacotes((prev) => [...prev, {
      id: data.id, nome: novoNome.trim(), quantidade_creditos: Number(novaQuantidade),
      preco_centavos: Math.round(Number(novoPreco) * 100), ordem: prev.length, ativo: true, criado_em: new Date().toISOString(),
    }]);
    setNovoNome(""); setNovaQuantidade(""); setNovoPreco("");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Coins className="h-4 w-4 text-primary" /> Pacotes de créditos avulsos
        </CardTitle>
        <CardDescription>
          O que aparece em /creditos pros usuários comprarem. Desativar mantém o histórico de compras antigas intacto, só some da vitrine.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Créditos</TableHead>
              <TableHead>Preço (R$)</TableHead>
              <TableHead>Ativo</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pacotes.map((p) => (
              <LinhaPacote key={p.id} pacote={p} onRemovido={(id) => setPacotes((prev) => prev.filter((x) => x.id !== id))} />
            ))}
          </TableBody>
        </Table>

        <div className="flex flex-wrap items-end gap-2 rounded-xl border border-dashed border-border p-3">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Nome</span>
            <Input className="h-8 w-32" value={novoNome} onChange={(e) => setNovoNome(e.target.value)} placeholder="Ex: Starter" />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Créditos</span>
            <Input type="number" min={1} className="h-8 w-24" value={novaQuantidade} onChange={(e) => setNovaQuantidade(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Preço (R$)</span>
            <Input type="number" min={0.01} step={0.01} className="h-8 w-24" value={novoPreco} onChange={(e) => setNovoPreco(e.target.value)} />
          </div>
          <Button size="sm" onClick={criar} disabled={criando || !novoNome.trim() || !novaQuantidade || !novoPreco}>
            <Plus className="h-3.5 w-3.5" /> Adicionar pacote
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
