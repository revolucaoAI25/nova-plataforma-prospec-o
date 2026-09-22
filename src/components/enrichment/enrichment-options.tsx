"use client";

import { SlidersHorizontal } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Collapsible } from "@/components/ui/collapsible";
import { NIVEIS_RACIOCINIO, NIVEL_PADRAO } from "@/lib/lead-enrichment-shared";
import type { NivelRaciocinio } from "@/lib/database.types";

export interface OpcoesUI {
  nivelRaciocinio: NivelRaciocinio;
  buscarSocios: boolean;
  buscarFundacao: boolean;
  buscarProcessos: boolean;
  camposCustomizadosTexto: string;
}

export const OPCOES_PADRAO: OpcoesUI = {
  nivelRaciocinio: NIVEL_PADRAO,
  buscarSocios: true,
  buscarFundacao: true,
  buscarProcessos: true,
  camposCustomizadosTexto: "",
};

function resumoExtras(v: OpcoesUI): string {
  const itens = [
    v.buscarSocios && "sócios",
    v.buscarFundacao && "fundação",
    v.buscarProcessos && "processos",
  ].filter(Boolean);
  return itens.length ? itens.join(", ") : "só o básico";
}

export function EnrichmentOptions({ value, onChange }: { value: OpcoesUI; onChange: (v: OpcoesUI) => void }) {
  return (
    <Card className="py-4">
      <CardContent className="px-4">
        <Collapsible
          trigger={
            <div className="flex items-center gap-2.5 py-0.5">
              <SlidersHorizontal className="h-4 w-4 shrink-0 text-primary" />
              <span className="text-sm font-medium">Opções avançadas</span>
              <span className="truncate text-xs text-muted-foreground">
                — {NIVEIS_RACIOCINIO[value.nivelRaciocinio].label.split(" (")[0]} · {resumoExtras(value)}
              </span>
            </div>
          }
        >
          <div className="flex flex-col gap-5 pt-5">
            <div className="flex flex-col gap-2">
              <Label>Nível de raciocínio da IA</Label>
              <RadioGroup
                value={value.nivelRaciocinio}
                onValueChange={(v) => onChange({ ...value, nivelRaciocinio: v as NivelRaciocinio })}
                className="flex flex-col gap-3"
              >
                {(Object.keys(NIVEIS_RACIOCINIO) as NivelRaciocinio[]).map((k) => (
                  <label key={k} className="flex items-start gap-2.5 text-sm">
                    <RadioGroupItem value={k} id={`nivel-${k}`} className="mt-0.5" />
                    <span className="flex flex-col gap-0.5">
                      <span className="font-medium">{NIVEIS_RACIOCINIO[k].label}</span>
                      <span className="text-xs text-muted-foreground">{NIVEIS_RACIOCINIO[k].descricao}</span>
                    </span>
                  </label>
                ))}
              </RadioGroup>
            </div>

            <div className="flex flex-col gap-2">
              <Label>O que a IA também deve tentar descobrir (além do básico: empresa, cargo, site, LinkedIn, resumo)</Label>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={value.buscarSocios} onCheckedChange={(c) => onChange({ ...value, buscarSocios: Boolean(c) })} />
                  Outros sócios/fundadores
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={value.buscarFundacao} onCheckedChange={(c) => onChange({ ...value, buscarFundacao: Boolean(c) })} />
                  Data de fundação
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={value.buscarProcessos} onCheckedChange={(c) => onChange({ ...value, buscarProcessos: Boolean(c) })} />
                  Indício de processo (JusBrasil)
                </label>
              </div>
              <p className="text-xs text-muted-foreground">
                Indício de processo é só um sim/não/não encontrado via busca — nunca detalhe do processo. Não é uma checagem jurídica oficial.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="campos-custom">Outros dados que você quer que a IA tente descobrir (um por linha, opcional)</Label>
              <Textarea
                id="campos-custom"
                rows={3}
                value={value.camposCustomizadosTexto}
                onChange={(e) => onChange({ ...value, camposCustomizadosTexto: e.target.value })}
                placeholder={"Número de funcionários\nFaturamento estimado\nPresença em redes sociais"}
              />
            </div>
          </div>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
