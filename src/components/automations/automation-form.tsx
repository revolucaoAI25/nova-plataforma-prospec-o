"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { MultiSelect, type MultiSelectOption } from "@/components/search/multi-select";
import { CNAES } from "@/lib/data/cnaes";
import { ESTADOS } from "@/lib/data/estados";
import { NOMES_NICHOS } from "@/lib/data/nichos";
import type { DispatchCampaignRow } from "@/lib/database.types";

const CNAE_OPTIONS: MultiSelectOption[] = CNAES.map((c) => ({ value: c.codigo, label: `${c.codigo} — ${c.descricao}` }));
const UF_OPTIONS: MultiSelectOption[] = Object.entries(ESTADOS).map(([sigla, nome]) => ({ value: sigla, label: `${sigla} — ${nome}` }));
const DIAS = [
  { value: 1, label: "Seg" }, { value: 2, label: "Ter" }, { value: 3, label: "Qua" },
  { value: 4, label: "Qui" }, { value: 5, label: "Sex" }, { value: 6, label: "Sáb" }, { value: 0, label: "Dom" },
];

export function AutomationForm({
  campanhas,
  onCreated,
  onCancel,
}: {
  campanhas: DispatchCampaignRow[];
  onCreated: () => void;
  onCancel: () => void;
}) {
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<"cnpj" | "maps">("cnpj");
  const [cnaes, setCnaes] = useState<string[]>([]);
  const [uf, setUf] = useState<string[]>([]);
  const [municipio, setMunicipio] = useState("");
  const [nicho, setNicho] = useState(NOMES_NICHOS[0]);
  const [localidade, setLocalidade] = useState("");
  const [limite, setLimite] = useState(50);
  const [diasSemana, setDiasSemana] = useState<number[]>([1, 2, 3, 4, 5]);
  const [horario, setHorario] = useState("08:00");
  const [sheetId, setSheetId] = useState("");
  const [sheetAba, setSheetAba] = useState("Leads");
  const [dispatchCampaignId, setDispatchCampaignId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleDia(d: number) {
    setDiasSemana((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!nome.trim()) return setError("Informe um nome para a automação.");
    if (!diasSemana.length) return setError("Selecione ao menos um dia da semana.");
    if (tipo === "cnpj" && (!cnaes.length || !uf.length)) return setError("Selecione ao menos um CNAE e um estado.");
    if (tipo === "maps" && !localidade.trim()) return setError("Informe ao menos uma cidade ou estado.");

    const filtros =
      tipo === "cnpj"
        ? { cnaes, uf, municipio: municipio.split(",").map((m) => m.trim()).filter(Boolean), limite, comTelefone: true, cnaeTipo: "principal" }
        : { queryBase: "", nicho, localidade: localidade.split(",").map((l) => l.trim()).filter(Boolean), limite, showPhone: true, showRating: true };

    setSaving(true);
    const resp = await fetch("/api/automations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome, tipo, filtros, diasSemana, horario,
        sheetId: sheetId || undefined, sheetAba,
        dispatchCampaignId: dispatchCampaignId || undefined,
      }),
    });
    setSaving(false);
    if (!resp.ok) {
      const data = await resp.json();
      setError(data.error || "Não foi possível criar a automação.");
      return;
    }
    onCreated();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Nova automação</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="auto-nome">Nome</Label>
            <Input id="auto-nome" value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Tipo de busca</Label>
            <RadioGroup value={tipo} onValueChange={(v) => setTipo(v as "cnpj" | "maps")} className="flex gap-6">
              <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="cnpj" id="auto-tipo-cnpj" /> CNPJ</label>
              <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="maps" id="auto-tipo-maps" /> Google Maps</label>
            </RadioGroup>
          </div>

          {tipo === "cnpj" ? (
            <>
              <div className="flex flex-col gap-2">
                <Label>CNAEs</Label>
                <MultiSelect options={CNAE_OPTIONS} selected={cnaes} onChange={setCnaes} />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Estados</Label>
                <MultiSelect options={UF_OPTIONS} selected={uf} onChange={setUf} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="auto-municipio">Municípios (opcional)</Label>
                <Input id="auto-municipio" value={municipio} onChange={(e) => setMunicipio(e.target.value)} placeholder="São Paulo, Campinas" />
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-2">
                <Label>Nicho</Label>
                <Select value={nicho} onValueChange={setNicho}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {NOMES_NICHOS.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="auto-localidade">Cidades ou estados</Label>
                <Input id="auto-localidade" value={localidade} onChange={(e) => setLocalidade(e.target.value)} placeholder="São Paulo, SP" />
              </div>
            </>
          )}

          <div className="flex max-w-xs flex-col gap-1.5">
            <Label htmlFor="auto-limite">Limite por execução</Label>
            <Input id="auto-limite" type="number" min={1} max={500} value={limite} onChange={(e) => setLimite(Number(e.target.value))} />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Dias da semana</Label>
            <div className="flex flex-wrap gap-3">
              {DIAS.map((d) => (
                <label key={d.value} className="flex items-center gap-1.5 text-sm">
                  <Checkbox checked={diasSemana.includes(d.value)} onCheckedChange={() => toggleDia(d.value)} />
                  {d.label}
                </label>
              ))}
            </div>
          </div>

          <div className="flex max-w-xs flex-col gap-1.5">
            <Label htmlFor="auto-horario">Horário(s) (separe por vírgula)</Label>
            <Input id="auto-horario" value={horario} onChange={(e) => setHorario(e.target.value)} placeholder="08:00,18:00" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="auto-sheet">ID da planilha Google Sheets (opcional)</Label>
              <Input id="auto-sheet" value={sheetId} onChange={(e) => setSheetId(e.target.value)} placeholder="Cole o ID ou URL da planilha" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="auto-aba">Aba</Label>
              <Input id="auto-aba" value={sheetAba} onChange={(e) => setSheetAba(e.target.value)} />
            </div>
          </div>

          {campanhas.length > 0 && (
            <div className="flex flex-col gap-2">
              <Label>Inscrever automaticamente numa campanha de disparo (opcional)</Label>
              <Select value={dispatchCampaignId || "__none"} onValueChange={(v) => setDispatchCampaignId(v === "__none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Nenhuma</SelectItem>
                  {campanhas.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex gap-2">
            <Button type="submit" disabled={saving}>{saving ? "Criando…" : "Criar automação"}</Button>
            <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
