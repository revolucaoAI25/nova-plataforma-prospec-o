"use client";

import { useMemo, useState } from "react";
import { Search, Download, Loader2, Building2, ListFilter, Phone, MapPinned } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FieldGroup, FieldRow, FieldGroupLabel } from "@/components/ui/field-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { MultiSelect, type MultiSelectOption } from "@/components/search/multi-select";
import { ResultsTable } from "@/components/search/results-table";
import { CNAES } from "@/lib/data/cnaes";
import { ESTADOS } from "@/lib/data/estados";
import type { CnaeTipo, Lead } from "@/lib/types";

const CNAE_OPTIONS: MultiSelectOption[] = CNAES.map((c) => ({
  value: c.codigo,
  label: `${c.codigo} — ${c.descricao}`,
  group: c.setor,
}));

const UF_OPTIONS: MultiSelectOption[] = Object.entries(ESTADOS).map(([sigla, nome]) => ({
  value: sigla,
  label: `${sigla} — ${nome}`,
}));

const PORTE_OPTIONS: MultiSelectOption[] = [
  { value: "01", label: "Microempresa (ME)" },
  { value: "03", label: "Empresa de Pequeno Porte (EPP)" },
  { value: "05", label: "Demais" },
];

type MapsModo = "nao_usar" | "enriquecer" | "filtrar" | "filtrar_enriquecer";

export function CnpjSearchForm() {
  const [cnaes, setCnaes] = useState<string[]>([]);
  const [cnaeManual, setCnaeManual] = useState("");
  const [cnaeTipo, setCnaeTipo] = useState<CnaeTipo>("principal");
  const [uf, setUf] = useState<string[]>([]);
  const [municipio, setMunicipio] = useState("");
  const [porte, setPorte] = useState<string[]>([]);
  const [matrizFilial, setMatrizFilial] = useState<"" | "MATRIZ" | "FILIAL">("");
  const [simples, setSimples] = useState<"indiferente" | "apenas" | "excluir">("indiferente");
  const [mei, setMei] = useState<"indiferente" | "apenas" | "excluir">("indiferente");
  const [dtIni, setDtIni] = useState("");
  const [dtFim, setDtFim] = useState("");
  const [capMin, setCapMin] = useState("");
  const [capMax, setCapMax] = useState("");
  const [comTelefone, setComTelefone] = useState(true);
  const [comEmail, setComEmail] = useState(false);
  const [tipoTelefone, setTipoTelefone] = useState<"todos" | "celular" | "fixo">("todos");
  const [excluirEmailContab, setExcluirEmailContab] = useState(true);
  const [apenasNovos, setApenasNovos] = useState(true);
  const [recuperacaoJudicial, setRecuperacaoJudicial] = useState(false);
  const [limite, setLimite] = useState(300);
  const [mapsModo, setMapsModo] = useState<MapsModo>("nao_usar");
  const [minAvaliacoes, setMinAvaliacoes] = useState(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avisos, setAvisos] = useState<string[]>([]);
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [searchId, setSearchId] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  const cnaesCodigos = useMemo(() => {
    const manual = cnaeManual.split(",").map((c) => c.trim()).filter(Boolean);
    return Array.from(new Set([...cnaes, ...manual]));
  }, [cnaes, cnaeManual]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setAvisos([]);

    if (!cnaesCodigos.length && !recuperacaoJudicial) {
      setError("Selecione ao menos um CNAE para buscar.");
      return;
    }
    if (!uf.length) {
      setError("Selecione ao menos um estado.");
      return;
    }
    if (dtIni && dtFim && dtIni > dtFim) {
      setError("A data 'Abertura — de' está depois da 'Abertura — até' — inverta as datas.");
      return;
    }

    setLoading(true);
    setLeads(null);

    try {
      const resp = await fetch("/api/search/cnpj", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cnaes: cnaesCodigos,
          uf,
          municipio: municipio.split(",").map((m) => m.trim()).filter(Boolean),
          porte,
          matrizFilial,
          simplesOptante: simples === "apenas" ? true : null,
          excluirSimples: simples === "excluir",
          meiOptante: mei === "apenas" ? true : null,
          excluirMei: mei === "excluir",
          comTelefone,
          comEmail,
          somenteCelular: tipoTelefone === "celular",
          somenteFixo: tipoTelefone === "fixo",
          excluirEmailContab,
          dataAberturaInicio: dtIni,
          dataAberturaFim: dtFim,
          capitalMin: capMin ? Number(capMin) : null,
          capitalMax: capMax ? Number(capMax) : null,
          limite,
          apenasNovos,
          cnaeTipo,
          recuperacaoJudicial,
          mapsModo,
          minAvaliacoes,
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
          <CardContent className="pt-6">
            <Tabs defaultValue="setor">
              <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
                <TabsTrigger value="setor"><Building2 className="h-3.5 w-3.5" /> Setor e localização</TabsTrigger>
                <TabsTrigger value="empresa"><ListFilter className="h-3.5 w-3.5" /> Filtros da empresa</TabsTrigger>
                <TabsTrigger value="contato"><Phone className="h-3.5 w-3.5" /> Contato</TabsTrigger>
                <TabsTrigger value="maps"><MapPinned className="h-3.5 w-3.5" /> Google Maps e limite</TabsTrigger>
              </TabsList>

              <TabsContent value="setor" className="flex flex-col gap-5">
            <div className="flex items-center justify-between gap-4 rounded-xl border border-primary/25 bg-accent p-3.5 text-sm">
              <div className="flex flex-col gap-0.5">
                <Label htmlFor="rj" className="text-accent-foreground">Modo Recuperação Judicial</Label>
                <span className="text-xs text-accent-foreground/70">Busca textual por &quot;recuperação judicial&quot; na razão social — dispensa CNAE.</span>
              </div>
              <Switch id="rj" checked={recuperacaoJudicial} onCheckedChange={setRecuperacaoJudicial} />
            </div>

            {!recuperacaoJudicial && (
              <div className="flex flex-col gap-2">
                <Label>CNAEs</Label>
                <MultiSelect options={CNAE_OPTIONS} selected={cnaes} onChange={setCnaes} placeholder="Buscar por código, descrição ou setor…" />
                <Input
                  value={cnaeManual}
                  onChange={(e) => setCnaeManual(e.target.value)}
                  placeholder="Ou digite códigos CNAE separados por vírgula (ex: 6911701, 6912500)"
                />
                <RadioGroup value={cnaeTipo} onValueChange={(v) => setCnaeTipo(v as CnaeTipo)} className="mt-1 grid-flow-col justify-start gap-6">
                  {([
                    ["principal", "Primário"],
                    ["secundario", "Secundário"],
                    ["ambos", "Primário ou Secundário"],
                  ] as const).map(([value, label]) => (
                    <label key={value} className="flex items-center gap-2 text-sm">
                      <RadioGroupItem value={value} id={`cnae-tipo-${value}`} />
                      {label}
                    </label>
                  ))}
                </RadioGroup>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Label>Estados (UF)</Label>
              <MultiSelect options={UF_OPTIONS} selected={uf} onChange={setUf} placeholder="Buscar estado…" />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="municipio">Municípios (opcional)</Label>
              <Input
                id="municipio"
                value={municipio}
                onChange={(e) => setMunicipio(e.target.value)}
                placeholder="Ex: São Paulo, Campinas, Santos"
              />
              <p className="text-xs text-muted-foreground">Separe múltiplos municípios por vírgula. Deixe vazio para buscar no estado inteiro.</p>
            </div>
              </TabsContent>

              <TabsContent value="empresa" className="flex flex-col gap-5">
            <div>
              <FieldGroupLabel>Classificação</FieldGroupLabel>
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label>Porte</Label>
                <MultiSelect options={PORTE_OPTIONS} selected={porte} onChange={setPorte} placeholder="Todos os portes" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Matriz/Filial</Label>
                <RadioGroup value={matrizFilial} onValueChange={(v) => setMatrizFilial(v as typeof matrizFilial)} className="flex flex-col gap-2">
                  {([
                    ["", "Todos"],
                    ["MATRIZ", "Somente Matriz"],
                    ["FILIAL", "Somente Filial"],
                  ] as const).map(([value, label]) => (
                    <label key={label} className="flex items-center gap-2 text-sm">
                      <RadioGroupItem value={value} id={`mf-${label}`} />
                      {label}
                    </label>
                  ))}
                </RadioGroup>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Simples Nacional</Label>
                <RadioGroup value={simples} onValueChange={(v) => setSimples(v as typeof simples)} className="flex flex-col gap-2">
                  {([
                    ["indiferente", "Indiferente"],
                    ["apenas", "Apenas optantes"],
                    ["excluir", "Excluir optantes"],
                  ] as const).map(([value, label]) => (
                    <label key={value} className="flex items-center gap-2 text-sm">
                      <RadioGroupItem value={value} id={`simples-${value}`} />
                      {label}
                    </label>
                  ))}
                </RadioGroup>
              </div>
              <div className="flex flex-col gap-2">
                <Label>MEI</Label>
                <RadioGroup value={mei} onValueChange={(v) => setMei(v as typeof mei)} className="flex flex-col gap-2">
                  {([
                    ["indiferente", "Indiferente"],
                    ["apenas", "Apenas MEI"],
                    ["excluir", "Excluir MEI"],
                  ] as const).map(([value, label]) => (
                    <label key={value} className="flex items-center gap-2 text-sm">
                      <RadioGroupItem value={value} id={`mei-${value}`} />
                      {label}
                    </label>
                  ))}
                </RadioGroup>
              </div>
            </div>
            </div>

            <div>
              <FieldGroupLabel>Abertura e capital social</FieldGroupLabel>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="dt-ini">Abertura — de</Label>
                <Input id="dt-ini" type="date" value={dtIni} onChange={(e) => setDtIni(e.target.value)} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="dt-fim">Abertura — até</Label>
                <Input id="dt-fim" type="date" value={dtFim} onChange={(e) => setDtFim(e.target.value)} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="cap-min">Capital social mínimo (R$)</Label>
                <Input id="cap-min" type="number" min={0} value={capMin} onChange={(e) => setCapMin(e.target.value)} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="cap-max">Capital social máximo (R$)</Label>
                <Input id="cap-max" type="number" min={0} value={capMax} onChange={(e) => setCapMax(e.target.value)} />
              </div>
            </div>
            </div>
              </TabsContent>

              <TabsContent value="contato" className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <Label>Tipo de telefone</Label>
              <RadioGroup value={tipoTelefone} onValueChange={(v) => setTipoTelefone(v as typeof tipoTelefone)} className="grid-flow-col justify-start gap-6">
                {([
                  ["todos", "Todos"],
                  ["celular", "Somente celular"],
                  ["fixo", "Somente fixo"],
                ] as const).map(([value, label]) => (
                  <label key={value} className="flex items-center gap-2 text-sm">
                    <RadioGroupItem value={value} id={`tel-${value}`} />
                    {label}
                  </label>
                ))}
              </RadioGroup>
            </div>

            <div>
              <FieldGroupLabel>Filtros</FieldGroupLabel>
              <FieldGroup>
                <FieldRow label="Apenas com telefone" control={<Switch checked={comTelefone} onCheckedChange={setComTelefone} />} />
                <FieldRow label="Apenas com e-mail" control={<Switch checked={comEmail} onCheckedChange={setComEmail} />} />
                <FieldRow
                  label="Excluir e-mails de contabilidade"
                  control={<Switch checked={excluirEmailContab} onCheckedChange={setExcluirEmailContab} />}
                />
                <FieldRow
                  label="Apenas leads novos"
                  description="Remove empresas com CNPJ ou telefone já salvos em buscas anteriores."
                  control={<Switch checked={apenasNovos} onCheckedChange={setApenasNovos} />}
                />
              </FieldGroup>
            </div>
              </TabsContent>

              <TabsContent value="maps" className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label>Google Maps</Label>
              <RadioGroup value={mapsModo} onValueChange={(v) => setMapsModo(v as MapsModo)} className="flex flex-col gap-2">
                {([
                  ["nao_usar", "Não usar"],
                  ["enriquecer", "Enriquecer (avaliação, telefone extra, site)"],
                  ["filtrar", "Filtrar (manter só quem tem perfil no Maps)"],
                  ["filtrar_enriquecer", "Filtrar e enriquecer"],
                ] as const).map(([value, label]) => (
                  <label key={value} className="flex items-center gap-2 text-sm">
                    <RadioGroupItem value={value} id={`maps-${value}`} />
                    {label}
                  </label>
                ))}
              </RadioGroup>
              {(mapsModo === "filtrar" || mapsModo === "filtrar_enriquecer") && (
                <div className="mt-1 flex max-w-xs flex-col gap-1.5">
                  <Label htmlFor="min-aval">Mínimo de avaliações no Google Maps</Label>
                  <Input id="min-aval" type="number" min={0} value={minAvaliacoes} onChange={(e) => setMinAvaliacoes(Number(e.target.value))} />
                </div>
              )}
            </div>
            <hr className="divider-fade" />
            <div className="flex max-w-xs flex-col gap-1.5">
              <Label htmlFor="limite">Limite de resultados (até 2000)</Label>
              <Input id="limite" type="number" min={1} max={2000} value={limite} onChange={(e) => setLimite(Number(e.target.value))} />
            </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Button type="submit" disabled={loading} size="lg" className="self-start">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          {loading ? "Buscando…" : "Buscar empresas por CNPJ"}
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
              <p className="text-sm text-muted-foreground">Nenhuma empresa encontrada com os filtros aplicados.</p>
            ) : (
              <ResultsTable leads={leads} />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
