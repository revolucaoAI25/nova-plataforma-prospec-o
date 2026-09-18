"use client";

import { useState } from "react";
import { Search, Download, Loader2, AtSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { FieldGroup, FieldRow } from "@/components/ui/field-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { InstagramResultsTable } from "@/components/search/instagram-results-table";
import type { InstagramTipo, Lead } from "@/lib/types";

export function InstagramSearchForm() {
  const [tipo, setTipo] = useState<InstagramTipo>("seguidores");
  const [alvo, setAlvo] = useState("");
  const [limite, setLimite] = useState(200);
  const LIMITE_MIN = 100;
  const LIMITE_MAX = 1000;
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

    if (!alvo.trim()) {
      setError("Informe um username ou URL de perfil.");
      return;
    }

    const limiteEfetivo = Math.min(LIMITE_MAX, Math.max(LIMITE_MIN, limite));

    setLoading(true);
    setLeads(null);

    try {
      const resp = await fetch("/api/search/instagram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo, alvo, limite: limiteEfetivo, apenasNovos }),
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
            <CardTitle className="flex items-center gap-2 text-base"><AtSign className="h-4 w-4 text-primary" /> Perfil alvo</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <Label>Tipo</Label>
              <RadioGroup value={tipo} onValueChange={(v) => setTipo(v as InstagramTipo)} className="flex gap-6">
                <label className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value="seguidores" id="tipo-seguidores" />
                  Seguidores
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value="seguindo" id="tipo-seguindo" />
                  Seguindo
                </label>
              </RadioGroup>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="alvo">Username ou URL do perfil</Label>
              <Input id="alvo" value={alvo} onChange={(e) => setAlvo(e.target.value)} placeholder="ex: nomeusuario ou https://instagram.com/nomeusuario" />
            </div>
            <FieldGroup>
              <FieldRow
                label="Apenas leads novos"
                description="Remove perfis já salvos em buscas anteriores."
                control={<Switch checked={apenasNovos} onCheckedChange={setApenasNovos} />}
              />
            </FieldGroup>
            <div className="flex max-w-xs flex-col gap-1.5">
              <Label htmlFor="limite">Limite de resultados</Label>
              <Input
                id="limite"
                type="number"
                min={LIMITE_MIN}
                max={LIMITE_MAX}
                value={limite}
                onChange={(e) => setLimite(Number(e.target.value))}
              />
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
          {loading ? "Buscando… (pode levar alguns minutos)" : "Buscar no Instagram"}
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
              <InstagramResultsTable leads={leads} />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
