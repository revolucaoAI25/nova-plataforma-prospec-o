import { Building2, MapPin, Sparkles, CircleAlert, CircleCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ResumoChavesUsuario } from "@/lib/key-resolution-summary";

const LINHAS: { chave: keyof ResumoChavesUsuario; label: string; icon: typeof Building2 }[] = [
  { chave: "cnpj", label: "Busca por CNPJ", icon: Building2 },
  { chave: "maps", label: "Google Maps (avulsa + verificação embutida na busca CNPJ)", icon: MapPin },
  { chave: "apify", label: "Apify (Instagram, LinkedIn, fallback de Maps)", icon: Sparkles },
];

/** Mostra, pra cada fonte de busca, qual chave está REALMENTE ativa pra esse usuário agora — não o que está configurado, o que seria usado de fato na próxima busca. */
export function KeyResolutionPanel({ resumo }: { resumo: ResumoChavesUsuario }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Resolução de chave agora</CardTitle>
        <CardDescription>
          Qual chave essa conta usaria numa busca AGORA, considerando chave própria, pool e fallback administrado —
          não é o que está configurado, é o resultado real da prioridade entre eles.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col divide-y divide-border">
        {LINHAS.map(({ chave, label, icon: Icon }) => {
          const r = resumo[chave];
          return (
            <div key={chave} className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{label}</p>
                  <p className="text-xs text-muted-foreground">{r.label}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {r.mascarada && <code className="rounded-md bg-secondary px-2 py-1 text-xs text-muted-foreground">{r.mascarada}</code>}
                {r.bloqueado ? (
                  <Badge variant="destructive"><CircleAlert className="h-3 w-3" /> Bloqueado (cota esgotada)</Badge>
                ) : r.source === "none" ? (
                  <Badge variant="outline">Não configurada</Badge>
                ) : (
                  <Badge variant="success"><CircleCheck className="h-3 w-3" /> Ativa</Badge>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
