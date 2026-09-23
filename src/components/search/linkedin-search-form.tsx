"use client";

import { useState } from "react";
import { Search, Download, Loader2, UserSearch, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { FieldGroup, FieldRow } from "@/components/ui/field-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { LinkedInResultsTable } from "@/components/search/linkedin-results-table";
import { ResultsSummary, buildLinkedInMetrics } from "@/components/search/results-summary";
import { MultiSelect } from "@/components/search/multi-select";
import { LINKEDIN_INDUSTRIES } from "@/lib/data/linkedin-industries";
import type { Lead } from "@/lib/types";

function TagInput({
  label,
  placeholder,
  values,
  onChange,
  hint,
}: {
  label: string;
  placeholder: string;
  values: string[];
  onChange: (v: string[]) => void;
  hint?: string;
}) {
  const [input, setInput] = useState("");

  function add() {
    const v = input.trim();
    if (v && !values.includes(v)) onChange([...values, v]);
    setInput("");
  }

  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
        />
        <Button type="button" variant="outline" onClick={add}>Adicionar</Button>
      </div>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {values.map((v) => (
            <Badge key={v} variant="secondary" className="gap-1 pr-1">
              {v}
              <button type="button" onClick={() => onChange(values.filter((x) => x !== v))} className="rounded-full hover:bg-border">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function LinkedInSearchForm() {
  const [cargos, setCargos] = useState<string[]>([]);
  const [localizacoes, setLocalizacoes] = useState<string[]>([]);
  const [industrias, setIndustrias] = useState<string[]>([]);
  const [palavraChave, setPalavraChave] = useState("");
  const [buscarEmail, setBuscarEmail] = useState(false);
  const [limite, setLimite] = useState(100);
  const [apenasNovos, setApenasNovos] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avisos, setAvisos] = useState<string[]>([]);
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [searchId, setSearchId] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setAvisos([]);

    if (!cargos.length && !localizacoes.length && !industrias.length && !palavraChave.trim()) {
      setError("Informe ao menos um cargo, localização, tipo de empresa ou palavra-chave.");
      return;
    }

    setLoading(true);
    setLeads(null);

    try {
      const resp = await fetch("/api/search/linkedin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cargos, localizacoes, industrias, palavraChave, buscarEmail, limite, apenasNovos }),
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
            <CardTitle className="flex items-center gap-2 text-base"><UserSearch className="h-4 w-4 text-primary" /> Cargo e localização</CardTitle>
            <CardDescription>Busca por pessoas/decisores no LinkedIn — combine os filtros abaixo.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <TagInput
                label="Cargos"
                placeholder="Ex: CEO, Head of Growth, Diretor Comercial"
                values={cargos}
                onChange={setCargos}
                hint="Um ou mais títulos de cargo a buscar."
              />
              <TagInput
                label="Localizações"
                placeholder="Ex: Belo Horizonte"
                values={localizacoes}
                onChange={setLocalizacoes}
                hint="Cidade, estado ou país — prefira só o nome da cidade (sem vírgula), o LinkedIn às vezes erra o local com texto mais longo."
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Tipo de empresa (setor/indústria)</Label>
              <MultiSelect
                options={LINKEDIN_INDUSTRIES}
                selected={industrias}
                onChange={setIndustrias}
                placeholder="Buscar setor… ex: Software Development, Fintech, Varejo"
              />
              <p className="text-xs text-muted-foreground">
                Filtra pelo setor da empresa atual do perfil — útil quando você busca um nicho, não só um cargo específico.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="palavra-chave">Palavra-chave (opcional)</Label>
              <Input
                id="palavra-chave"
                value={palavraChave}
                onChange={(e) => setPalavraChave(e.target.value)}
                placeholder="Busca livre — ex: marketing SaaS B2B"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Opções</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <FieldGroup>
              <FieldRow
                label="Apenas leads novos"
                description="Remove perfis já salvos em buscas anteriores."
                control={<Switch checked={apenasNovos} onCheckedChange={setApenasNovos} />}
              />
              <FieldRow
                label="Buscar e-mail"
                description="Tenta encontrar o e-mail de cada perfil (custa mais no Apify — cerca de 2,5x o preço por perfil — e não é garantido para todos)."
                control={<Switch checked={buscarEmail} onCheckedChange={setBuscarEmail} />}
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
          {loading ? "Buscando… (pode levar alguns minutos)" : "Buscar no LinkedIn"}
        </Button>
      </form>

      {avisos.map((a, i) => (
        <Alert key={i} variant="info">
          <AlertDescription>{a}</AlertDescription>
        </Alert>
      ))}

      {leads && (
        <Card>
          <CardHeader className="flex flex-wrap items-center justify-between gap-2">
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
                <ResultsSummary metrics={buildLinkedInMetrics(leads)} />
                <LinkedInResultsTable leads={leads} />
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
