"use client";

import { useState } from "react";
import { Crown, Save, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useConfirm } from "@/components/ui/confirm-provider";
import type { PlanRow } from "@/lib/database.types";

function LinhaPlano({ plano, onRemovido }: { plano: PlanRow; onRemovido: (id: string) => void }) {
  const confirmar = useConfirm();
  const [nome, setNome] = useState(plano.nome);
  const [preco, setPreco] = useState(plano.preco_centavos / 100);
  const [creditosMensais, setCreditosMensais] = useState(plano.creditos_mensais);
  const [ativo, setAtivo] = useState(plano.ativo);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  async function salvar() {
    setSaving(true);
    const resp = await fetch("/api/admin/plans", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: plano.id, nome, precoCentavos: Math.round(preco * 100), creditosMensais }),
    });
    setSaving(false);
    if (resp.ok) setDirty(false);
  }

  async function alternarAtivo(v: boolean) {
    setAtivo(v);
    await fetch("/api/admin/plans", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: plano.id, ativo: v }),
    });
  }

  async function remover() {
    if (!(await confirmar({ title: `Remover o plano "${plano.nome}"?`, description: "Assinantes ativos desse plano continuam ativos, mas ele some da vitrine.", destructive: true }))) return;
    const resp = await fetch("/api/admin/plans", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: plano.id }),
    });
    if (resp.ok) onRemovido(plano.id);
  }

  return (
    <TableRow>
      <TableCell>
        <Input className="h-8 w-32" value={nome} onChange={(e) => { setNome(e.target.value); setDirty(true); }} />
      </TableCell>
      <TableCell>
        <Input
          type="number" min={0.01} step={0.01} className="h-8 w-24"
          value={preco}
          onChange={(e) => { setPreco(Number(e.target.value)); setDirty(true); }}
        />
      </TableCell>
      <TableCell>
        <Input
          type="number" min={0} className="h-8 w-28"
          value={creditosMensais}
          onChange={(e) => { setCreditosMensais(Number(e.target.value)); setDirty(true); }}
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

/** CRUD dos planos de assinatura recorrente — mesma filosofia dos outros painéis admin: preço/créditos mensais editáveis sem deploy. */
export function PlansPanel({ planosIniciais }: { planosIniciais: PlanRow[] }) {
  const [planos, setPlanos] = useState(planosIniciais);
  const [novoNome, setNovoNome] = useState("");
  const [novoPreco, setNovoPreco] = useState("");
  const [novosCreditos, setNovosCreditos] = useState("");
  const [criando, setCriando] = useState(false);

  async function criar() {
    if (!novoNome.trim() || !novoPreco || !novosCreditos) return;
    setCriando(true);
    const resp = await fetch("/api/admin/plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: novoNome.trim(),
        precoCentavos: Math.round(Number(novoPreco) * 100),
        creditosMensais: Number(novosCreditos),
        ordem: planos.length,
      }),
    });
    setCriando(false);
    if (!resp.ok) return;
    const data = await resp.json();
    setPlanos((prev) => [...prev, {
      id: data.id, nome: novoNome.trim(), preco_centavos: Math.round(Number(novoPreco) * 100),
      creditos_mensais: Number(novosCreditos), ordem: prev.length, ativo: true, descricao: null, criado_em: new Date().toISOString(),
    }]);
    setNovoNome(""); setNovoPreco(""); setNovosCreditos("");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Crown className="h-4 w-4 text-primary" /> Planos de assinatura
        </CardTitle>
        <CardDescription>
          O que aparece em Créditos → Planos. Assinatura recorrente mensal via Asaas — renovação confirmada credita os créditos mensais automaticamente.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Preço/mês (R$)</TableHead>
              <TableHead>Créditos/mês</TableHead>
              <TableHead>Ativo</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {planos.map((p) => (
              <LinhaPlano key={p.id} plano={p} onRemovido={(id) => setPlanos((prev) => prev.filter((x) => x.id !== id))} />
            ))}
          </TableBody>
        </Table>

        <div className="flex flex-wrap items-end gap-2 rounded-xl border border-dashed border-border p-3">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Nome</span>
            <Input className="h-8 w-32" value={novoNome} onChange={(e) => setNovoNome(e.target.value)} placeholder="Ex: Pro" />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Preço/mês (R$)</span>
            <Input type="number" min={0.01} step={0.01} className="h-8 w-24" value={novoPreco} onChange={(e) => setNovoPreco(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Créditos/mês</span>
            <Input type="number" min={0} className="h-8 w-28" value={novosCreditos} onChange={(e) => setNovosCreditos(e.target.value)} />
          </div>
          <Button size="sm" onClick={criar} disabled={criando || !novoNome.trim() || !novoPreco || !novosCreditos}>
            <Plus className="h-3.5 w-3.5" /> Adicionar plano
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
