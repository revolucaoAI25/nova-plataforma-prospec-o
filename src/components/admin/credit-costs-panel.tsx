"use client";

import { useState } from "react";
import { Coins, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { CreditCostRow } from "@/lib/database.types";

function LinhaCusto({ custo }: { custo: CreditCostRow }) {
  const [valor, setValor] = useState(custo.custo);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  async function salvar() {
    setSaving(true);
    const resp = await fetch("/api/admin/credit-costs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acao: custo.acao, custo: valor }),
    });
    setSaving(false);
    if (resp.ok) setDirty(false);
  }

  return (
    <TableRow>
      <TableCell className="font-medium">{custo.descricao}</TableCell>
      <TableCell className="text-muted-foreground">{custo.acao}</TableCell>
      <TableCell>
        <Input
          type="number"
          min={1}
          className="h-8 w-24"
          value={valor}
          onChange={(e) => {
            setValor(Number(e.target.value));
            setDirty(true);
          }}
        />
      </TableCell>
      <TableCell className="text-right">
        <Button size="sm" variant={dirty ? "default" : "ghost"} disabled={!dirty || saving} onClick={salvar}>
          <Save className="h-4 w-4" /> {saving ? "Salvando…" : "Salvar"}
        </Button>
      </TableCell>
    </TableRow>
  );
}

/** Editor do peso (em créditos) de cada ação — ajustar aqui não precisa de deploy, só refaz a leitura em até 1min (cache em credits.ts). */
export function CreditCostsPanel({ custos }: { custos: CreditCostRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Coins className="h-4 w-4 text-primary" /> Custo por ação (créditos)
        </CardTitle>
        <CardDescription>
          Quanto cada ação debita do pool único de créditos. Ajustar aqui vale pra todos os usuários — mudanças no preço de um fornecedor não exigem deploy, só atualizar o número.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ação</TableHead>
              <TableHead>Chave</TableHead>
              <TableHead>Créditos</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {custos.map((c) => (
              <LinhaCusto key={c.acao} custo={c} />
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
