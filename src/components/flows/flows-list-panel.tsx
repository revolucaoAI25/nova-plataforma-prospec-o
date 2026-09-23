"use client";

import Link from "next/link";
import { Workflow, Plus, Play, Pause } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { FLOW_NODE_TYPES } from "@/lib/flow/node-types";
import type { AutomationFlowRow, FlowNodeTipo } from "@/lib/database.types";

function resumoDoFluxo(flow: AutomationFlowRow): string {
  const gatilho = flow.nodes.find((n) =>
    (["gatilho_agendado", "gatilho_filtro_leads", "gatilho_planilha", "gatilho_manual"] as FlowNodeTipo[]).includes(n.tipo),
  );
  const passos = flow.nodes.length;
  const gatilhoLabel = gatilho ? FLOW_NODE_TYPES[gatilho.tipo].label : "sem gatilho";
  return `${gatilhoLabel} · ${passos} nó(s)`;
}

export function FlowsListPanel({ fluxosIniciais }: { fluxosIniciais: AutomationFlowRow[] }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Fluxos</h2>
          <p className="text-sm text-muted-foreground">Construtor visual — monte fluxos combinando gatilho, extração, enriquecimento, disparo e destino livremente.</p>
        </div>
        <Button asChild size="sm">
          <Link href="/automacoes/fluxos/novo"><Plus className="h-3.5 w-3.5" /> Novo fluxo</Link>
        </Button>
      </div>

      {!fluxosIniciais.length ? (
        <EmptyState
          icon={Workflow}
          title="Nenhum fluxo criado ainda"
          description="Combine módulos de extração, enriquecimento, disparo e exportação num fluxo visual, do seu jeito."
          action={
            <Button asChild size="sm">
              <Link href="/automacoes/fluxos/novo"><Plus className="h-3.5 w-3.5" /> Criar o primeiro fluxo</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {fluxosIniciais.map((flow) => (
            <Link key={flow.id} href={`/automacoes/fluxos/${flow.id}`}>
              <Card className="h-full transition-colors hover:border-primary/40">
                <CardHeader className="flex flex-row items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{flow.nome}</CardTitle>
                    <CardDescription>{resumoDoFluxo(flow)}</CardDescription>
                  </div>
                  <Badge variant={flow.ativo ? "success" : "secondary"}>
                    {flow.ativo ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
                    {flow.ativo ? "Ativo" : "Pausado"}
                  </Badge>
                </CardHeader>
                <CardContent />
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
