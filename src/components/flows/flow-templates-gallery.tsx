"use client";

import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FLOW_TEMPLATES } from "@/lib/flow/templates";
import { FLOW_NODE_ICONS } from "./node-visuals";

export function FlowTemplatesGallery() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <Sparkles className="h-4 w-4 text-primary" /> Templates de fluxo
        </h2>
        <p className="text-sm text-muted-foreground">
          Ponto de partida pronto — escolha um, complete os campos que são só seus (planilha, campanha, CNAEs…) e salve.
          Continua 100% editável depois: adicione, remova ou reconecte nós à vontade.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FLOW_TEMPLATES.map((t) => {
          const Icon = FLOW_NODE_ICONS[t.icon];
          return (
            <Card key={t.id} className="flex h-full flex-col">
              <CardHeader>
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
                    <Icon className="h-4 w-4" />
                  </span>
                  <CardTitle className="text-base leading-tight">{t.nome}</CardTitle>
                </div>
                <CardDescription>{t.descricao}</CardDescription>
              </CardHeader>
              <CardContent className="mt-auto flex flex-col gap-3">
                <p className="rounded-lg border border-dashed border-border bg-secondary/20 px-2.5 py-2 text-xs text-muted-foreground">
                  {t.resumoEtapas}
                </p>
                <Button asChild size="sm" variant="outline" className="self-start">
                  <Link href={`/automacoes/fluxos/novo?template=${t.id}`}>
                    Usar este template <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
