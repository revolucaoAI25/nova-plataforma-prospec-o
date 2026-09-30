"use client";

import { useState } from "react";
import { Puzzle, Save, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useConfirm } from "@/components/ui/confirm-provider";
import { PLAN_FEATURE_FLAG_KEYS, type AddonRow, type PlanFeatureFlags } from "@/lib/database.types";

const FEATURE_FLAG_LABELS: Record<keyof PlanFeatureFlags, string> = {
  disparo_habilitado: "Disparo WhatsApp",
  instagram_visible: "Busca Instagram",
  linkedin_visible: "Busca LinkedIn",
  enriquecimento_ia_habilitado: "Enriquecimento via IA",
  bigdatacorp_enrichment_habilitado: "Enriquecimento por CNPJ (BigDataCorp)",
  email_disparo_habilitado: "Disparo e-mail",
  linkedin_disparo_habilitado: "Disparo LinkedIn",
};

function LinhaAddon({ addon, onRemovido }: { addon: AddonRow; onRemovido: (id: string) => void }) {
  const confirmar = useConfirm();
  const [nome, setNome] = useState(addon.nome);
  const [preco, setPreco] = useState(addon.preco_centavos / 100);
  const [featureFlag, setFeatureFlag] = useState(addon.feature_flag);
  const [ativo, setAtivo] = useState(addon.ativo);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  async function salvar() {
    setSaving(true);
    const resp = await fetch("/api/admin/addons", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: addon.id, nome, precoCentavos: Math.round(preco * 100), featureFlag }),
    });
    setSaving(false);
    if (resp.ok) setDirty(false);
  }

  async function alternarAtivo(v: boolean) {
    setAtivo(v);
    await fetch("/api/admin/addons", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: addon.id, ativo: v }),
    });
  }

  async function remover() {
    if (!(await confirmar({ title: `Remover o add-on "${addon.nome}"?`, description: "Assinantes ativos continuam ativos, mas ele some da vitrine.", destructive: true }))) return;
    const resp = await fetch("/api/admin/addons", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: addon.id }),
    });
    if (resp.ok) onRemovido(addon.id);
  }

  return (
    <TableRow>
      <TableCell>
        <Input className="h-8 w-40" value={nome} onChange={(e) => { setNome(e.target.value); setDirty(true); }} />
      </TableCell>
      <TableCell>
        <Input
          type="number" min={0.01} step={0.01} className="h-8 w-24"
          value={preco}
          onChange={(e) => { setPreco(Number(e.target.value)); setDirty(true); }}
        />
      </TableCell>
      <TableCell>
        <Select value={featureFlag} onValueChange={(v) => { setFeatureFlag(v as typeof featureFlag); setDirty(true); }}>
          <SelectTrigger className="h-8 w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            {PLAN_FEATURE_FLAG_KEYS.map((k) => (
              <SelectItem key={k} value={k}>{FEATURE_FLAG_LABELS[k]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
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

/** CRUD dos add-ons pagos avulsos (assinatura recorrente à parte do plano) — ver 0025_addon_subscriptions.sql. */
export function AddonsPanel({ addonsIniciais }: { addonsIniciais: AddonRow[] }) {
  const [addons, setAddons] = useState(addonsIniciais);
  const [novoNome, setNovoNome] = useState("");
  const [novoPreco, setNovoPreco] = useState("");
  const [novoFlag, setNovoFlag] = useState<(typeof PLAN_FEATURE_FLAG_KEYS)[number]>("linkedin_disparo_habilitado");
  const [criando, setCriando] = useState(false);

  async function criar() {
    if (!novoNome.trim() || !novoPreco) return;
    setCriando(true);
    const resp = await fetch("/api/admin/addons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: novoNome.trim(),
        precoCentavos: Math.round(Number(novoPreco) * 100),
        featureFlag: novoFlag,
        ordem: addons.length,
      }),
    });
    setCriando(false);
    if (!resp.ok) return;
    const data = await resp.json();
    setAddons((prev) => [...prev, {
      id: data.id, nome: novoNome.trim(), preco_centavos: Math.round(Number(novoPreco) * 100),
      feature_flag: novoFlag, ordem: prev.length, ativo: true, descricao: null, criado_em: new Date().toISOString(),
    }]);
    setNovoNome(""); setNovoPreco("");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Puzzle className="h-4 w-4 text-primary" /> Add-ons pagos (assinatura recorrente)
        </CardTitle>
        <CardDescription>
          O que aparece em Créditos → Extras. Cada add-on libera UM recurso específico via assinatura própria, independente do plano do usuário.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Preço/mês (R$)</TableHead>
              <TableHead>Recurso liberado</TableHead>
              <TableHead>Ativo</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {addons.map((a) => (
              <LinhaAddon key={a.id} addon={a} onRemovido={(id) => setAddons((prev) => prev.filter((x) => x.id !== id))} />
            ))}
          </TableBody>
        </Table>

        <div className="flex flex-wrap items-end gap-2 rounded-xl border border-dashed border-border p-3">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Nome</span>
            <Input className="h-8 w-40" value={novoNome} onChange={(e) => setNovoNome(e.target.value)} placeholder="Ex: Disparo por LinkedIn" />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Preço/mês (R$)</span>
            <Input type="number" min={0.01} step={0.01} className="h-8 w-24" value={novoPreco} onChange={(e) => setNovoPreco(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Recurso liberado</span>
            <Select value={novoFlag} onValueChange={(v) => setNovoFlag(v as typeof novoFlag)}>
              <SelectTrigger className="h-8 w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PLAN_FEATURE_FLAG_KEYS.map((k) => (
                  <SelectItem key={k} value={k}>{FEATURE_FLAG_LABELS[k]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" onClick={criar} disabled={criando || !novoNome.trim() || !novoPreco}>
            <Plus className="h-3.5 w-3.5" /> Adicionar add-on
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
