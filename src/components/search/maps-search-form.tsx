"use client";

import { useState } from "react";
import { Search, Download, Loader2, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { ResultsTable } from "@/components/search/results-table";
import { NICHOS, NOMES_NICHOS } from "@/lib/data/nichos";
import type { Lead } from "@/lib/types";

const OUTRO = "Outro / Personalizado";

export function MapsSearchForm() {
  const [nicho, setNicho] = useState(NOMES_NICHOS[0]);
  const [queryCustom, setQueryCustom] = useState("");
  const [subnicho, setSubnicho] = useState("");
  const [localidadeInput, setLocalidadeInput] = useState("");
  const [localidades, setLocalidades] = useState<string[]>([]);
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

  function addLocalidade() {
    const v = localidadeInput.trim();
    if (v && !localidades.includes(v)) setLocalidades([...localidades, v]);
    setLocalidadeInput("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setAvisos([]);

    const locs = localidades.length ? localidades : localidadeInput.trim() ? [localidadeInput.trim()] : [];
    if (!locs.length) {
      setError("Informe ao menos uma cidade ou estado.");
      return;
    }
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
            <CardTitle className="text-base">Nicho e localidade</CardTitle>
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

            <div className="flex flex-col gap-2">
              <Label htmlFor="localidade">Cidades ou estados</Label>
              <div className="flex gap-2">
                <Input
                  id="localidade"
                  value={localidadeInput}
                  onChange={(e) => setLocalidadeInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addLocalidade();
                    }
                  }}
                  placeholder="Ex: São Paulo, SP  ou  SP"
                />
                <Button type="button" variant="outline" onClick={addLocalidade}>Adicionar</Button>
              </div>
              {localidades.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {localidades.map((l) => (
                    <Badge key={l} variant="secondary" className="gap-1 pr-1">
                      {l}
                      <button type="button" onClick={() => setLocalidades(localidades.filter((x) => x !== l))} className="rounded-full hover:bg-border">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Pode informar várias localidades — os resultados são divididos entre elas até o limite total.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Opções</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <label className="flex items-center justify-between rounded-xl border border-border p-3 text-sm">
              <span>
                Buscar telefone e site
                <span className="block text-xs font-normal text-muted-foreground">Consome cota mais restrita (Contact Data). Desligue para buscas rápidas só com nome/endereço/avaliação.</span>
              </span>
              <Switch checked={showPhone} onCheckedChange={setShowPhone} />
            </label>
            <label className="flex items-center justify-between rounded-xl border border-border p-3 text-sm">
              Incluir avaliação
              <Switch checked={showRating} onCheckedChange={setShowRating} />
            </label>
            <label className="flex items-center justify-between rounded-xl border border-border p-3 text-sm">
              <span>
                Apenas leads novos
                <span className="block text-xs font-normal text-muted-foreground">Remove empresas com telefone já salvo em buscas anteriores.</span>
              </span>
              <Switch checked={apenasNovos} onCheckedChange={setApenasNovos} />
            </label>
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
          <CardContent>
            {leads.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum resultado encontrado.</p>
            ) : (
              <ResultsTable leads={leads} />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
