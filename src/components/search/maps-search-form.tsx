"use client";

import { useState } from "react";
import { Search, Download, Loader2, X, MapPin, SlidersHorizontal } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { FieldGroup, FieldRow } from "@/components/ui/field-group";
import { MultiSelect, type MultiSelectOption } from "@/components/search/multi-select";
import { ResultsTable } from "@/components/search/results-table";
import { ResultsSummary, buildGeneralMetrics } from "@/components/search/results-summary";
import { NICHOS, NOMES_NICHOS } from "@/lib/data/nichos";
import { ESTADOS } from "@/lib/data/estados";
import type { Lead } from "@/lib/types";

const OUTRO = "Outro / Personalizado";

const UF_OPTIONS: MultiSelectOption[] = Object.entries(ESTADOS).map(([sigla, nome]) => ({
  value: sigla,
  label: `${sigla} — ${nome}`,
}));

export function MapsSearchForm() {
  const [nicho, setNicho] = useState(NOMES_NICHOS[0]);
  const [queryCustom, setQueryCustom] = useState("");
  const [subnicho, setSubnicho] = useState("");
  const [cidadeInput, setCidadeInput] = useState("");
  const [cidades, setCidades] = useState<string[]>([]);
  const [estados, setEstados] = useState<string[]>([]);
  const [limite, setLimite] = useState(60);
  const [showPhone, setShowPhone] = useState(true);
  const [showRating, setShowRating] = useState(true);
  const [apenasNovos, setApenasNovos] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avisos, setAvisos] = useState<string[]>([]);
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [searchId, setSearchId] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  const subnichosDisponiveis = NICHOS[nicho]?.subnichos ?? [];

  function addCidade() {
    const v = cidadeInput.trim();
    if (v && !cidades.includes(v)) setCidades([...cidades, v]);
    setCidadeInput("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setAvisos([]);

    if (!cidades.length && !estados.length) {
      setError("Informe ao menos uma cidade ou um estado.");
      return;
    }
    if (cidades.length && estados.length !== 1) {
      setError(
        "Selecione vários estados só quando o campo Cidades estiver vazio (busca ampla). Com cidade(s) preenchida(s), escolha exatamente um estado.",
      );
      return;
    }
    const locs = cidades.length
      ? cidades.map((c) => `${c}, ${ESTADOS[estados[0]] ?? estados[0]}`)
      : estados.map((uf) => ESTADOS[uf] ?? uf);
    if (nicho === OUTRO && !queryCustom.trim()) {
      setError("Informe um termo de busca para o nicho personalizado.");
      return;
    }

    setLoading(true);
    setLeads(null);

    try {
      const resp = await fetch("/api/search/maps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nicho,
          queryCustom,
          subnicho,
          localidades: locs,
          limite,
          showPhone,
          showRating,
          apenasNovos,
        }),
      });

      const data = await resp.json();
      if (!resp.ok) {
        setError(data.error || "Ocorreu um erro na busca.");
        return;
      }

      setLeads(data.leads);
      setTotal(data.total);
      setSearchId(data.searchId);
      setAvisos(data.avisos || []);
    } catch {
      setError("Não foi possível conectar ao servidor. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><MapPin className="h-4 w-4 text-primary" /> Nicho e localidade</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <Label>Nicho</Label>
              <Select value={nicho} onValueChange={(v) => { setNicho(v); setSubnicho(""); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {NOMES_NICHOS.map((n) => (
                    <SelectItem key={n} value={n}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {nicho === OUTRO ? (
              <div className="flex flex-col gap-2">
                <Label htmlFor="query-custom">Termo de busca</Label>
                <Input id="query-custom" value={queryCustom} onChange={(e) => setQueryCustom(e.target.value)} placeholder="Ex: pet shop, barbearia, marcenaria…" />
              </div>
            ) : subnichosDisponiveis.length > 0 ? (
              <div className="flex flex-col gap-2">
                <Label>Subnicho (opcional)</Label>
                <Select value={subnicho || "__none"} onValueChange={(v) => setSubnicho(v === "__none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Todos</SelectItem>
                    {subnichosDisponiveis.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="cidade">Cidades (opcional)</Label>
                <div className="flex gap-2">
                  <Input
                    id="cidade"
                    value={cidadeInput}
                    onChange={(e) => setCidadeInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addCidade();
                      }
                    }}
                    placeholder="Ex: São Paulo, Campinas, Santos"
                  />
                  <Button type="button" variant="outline" onClick={addCidade}>Adicionar</Button>
                </div>
                {cidades.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {cidades.map((c) => (
                      <Badge key={c} variant="secondary" className="gap-1 pr-1">
                        {c}
                        <button type="button" onClick={() => setCidades(cidades.filter((x) => x !== c))} className="rounded-full hover:bg-border">
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">Preenchendo cidade(s), escolha exatamente um estado ao lado.</p>
              </div>

              <div className="flex flex-col gap-2">
                <Label>Estado (UF)</Label>
                <MultiSelect options={UF_OPTIONS} selected={estados} onChange={setEstados} placeholder="Buscar estado…" />
                <p className="text-xs text-muted-foreground">
                  Sem cidade preenchida, pode selecionar vários estados — busca ampla, sem cidade específica.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><SlidersHorizontal className="h-4 w-4 text-primary" /> Opções</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <FieldGroup>
              <FieldRow
                label="Buscar telefone e site"
                description="Consome cota mais restrita (Contact Data). Desligue para buscas rápidas só com nome/endereço/avaliação."
                control={<Switch checked={showPhone} onCheckedChange={setShowPhone} />}
              />
              <FieldRow label="Incluir avaliação" control={<Switch checked={showRating} onCheckedChange={setShowRating} />} />
              <FieldRow
                label="Apenas leads novos"
                description="Remove empresas com telefone já salvo em buscas anteriores."
                control={<Switch checked={apenasNovos} onCheckedChange={setApenasNovos} />}
              />
            </FieldGroup>
            <div className="flex max-w-xs flex-col gap-1.5">
              <Label htmlFor="limite">Limite de resultados</Label>
              <Input id="limite" type="number" min={1} max={500} value={limite} onChange={(e) => setLimite(Number(e.target.value))} />
            </div>
          </CardContent>
        </Card>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Button type="submit" disabled={loading} size="lg" className="self-start">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          {loading ? "Buscando…" : "Buscar no Google Maps"}
        </Button>
      </form>

      {avisos.map((a, i) => (
        <Alert key={i} variant="info">
          <AlertDescription>{a}</AlertDescription>
        </Alert>
      ))}

      {leads && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Badge>{total} resultados</Badge>
              </CardTitle>
              <CardDescription>Salvos no histórico automaticamente.</CardDescription>
            </div>
            {searchId && (
              <div className="flex gap-2">
                <Button asChild variant="outline" size="sm">
                  <a href={`/api/export/${searchId}?formato=xlsx`}>
                    <Download className="h-4 w-4" /> Excel
                  </a>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <a href={`/api/export/${searchId}?formato=csv`}>
                    <Download className="h-4 w-4" /> CSV
                  </a>
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            {leads.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum resultado encontrado.</p>
            ) : (
              <>
                <ResultsSummary metrics={buildGeneralMetrics(leads)} />
                <ResultsTable leads={leads} />
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
