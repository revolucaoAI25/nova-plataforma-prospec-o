"use client";

import { useState } from "react";
import { Loader2, Lock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { FieldGroup, FieldRow } from "@/components/ui/field-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useConfirm } from "@/components/ui/confirm-provider";
import { formatarDataHora } from "@/lib/datas";
import type { CondicaoPreco } from "@/lib/condicao-preco";

const reais = (centavos: number) => (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const ROTULO_ACAO: Record<string, string> = {
  cnpj: "Busca por CNPJ (empresa)",
  cnpj_maps_extra: "Verificação de telefone/site no Maps",
  maps: "Busca no Maps (empresa)",
  instagram: "Busca no Instagram (perfil)",
  linkedin: "Busca no LinkedIn (perfil)",
  bigdatacorp: "Sócios e contato (empresa)",
  socio_celular: "Celular do sócio (cada sócio)",
};

/**
 * "Manter a condição de preço atual" de um cliente: ao ligar, o servidor
 * fotografa a tabela de preços de agora e o cliente fica nela mesmo que os
 * preços subam depois (ver src/lib/condicao-preco.ts).
 */
export function CondicaoPrecoForm({
  userId, inicial, nomesPlanos, nomesPacotes,
}: {
  userId: string;
  inicial: CondicaoPreco | null;
  nomesPlanos: Record<string, string>;
  nomesPacotes: Record<string, string>;
}) {
  const confirmar = useConfirm();
  const [condicao, setCondicao] = useState(inicial);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function alternar(ligar: boolean) {
    if (!ligar && !(await confirmar({
      title: "Tirar a condição de preço travada?",
      description: "O cliente passa a seguir a tabela de preços atual: consumo de créditos e créditos do plano mudam já; preço do plano e dos pacotes, na próxima contratação.",
      destructive: true,
    }))) return;
    setSalvando(true);
    setErro(null);
    const resp = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ manterCondicaoPreco: ligar }),
    }).catch(() => null);
    const data = resp ? await resp.json().catch(() => null) : null;
    setSalvando(false);
    if (!resp?.ok) {
      setErro(data?.error || "Não foi possível salvar.");
      return;
    }
    setCondicao(ligar ? (data?.condicaoPreco ?? null) : null);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><Lock className="h-4 w-4 text-primary" /> Condição de preço</CardTitle>
        <CardDescription>
          Ao ligar, este cliente fica com os preços de hoje (planos, créditos por mês, pacotes avulsos e consumo de créditos por
          ação), mesmo que você suba a tabela depois. Ligue <strong>antes</strong> de mudar os preços.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <FieldGroup>
          <FieldRow
            label="Manter a condição de preço atual"
            description={condicao ? `Travada em ${formatarDataHora(condicao.capturada_em)}.` : "Desligado: segue a tabela de preços atual."}
            control={
              <span className="flex items-center gap-2">
                {salvando && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                <Switch checked={Boolean(condicao)} onCheckedChange={alternar} disabled={salvando} aria-label="Manter a condição de preço atual" />
              </span>
            }
          />
        </FieldGroup>
        {erro && <Alert variant="destructive"><AlertDescription>{erro}</AlertDescription></Alert>}
        {condicao && (
          <div className="grid gap-4 text-sm sm:grid-cols-3">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-2">Planos</span>
              {Object.entries(condicao.planos).map(([id, p]) => (
                <span key={id}>{nomesPlanos[id] ?? "Plano removido"}: {reais(p.preco_centavos)}/mês · {p.creditos_mensais.toLocaleString("pt-BR")} créditos</span>
              ))}
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-2">Pacotes avulsos</span>
              {Object.entries(condicao.pacotes).map(([id, p]) => (
                <span key={id}>{nomesPacotes[id] ?? "Pacote removido"}: {p.quantidade_creditos.toLocaleString("pt-BR")} por {reais(p.preco_centavos)}</span>
              ))}
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-2">Consumo (créditos)</span>
              {Object.entries(condicao.custos).map(([acao, c]) => (
                <span key={acao}>{ROTULO_ACAO[acao] ?? acao}: {c}</span>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
