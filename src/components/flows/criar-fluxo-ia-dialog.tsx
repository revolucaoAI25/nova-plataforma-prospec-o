"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const EXEMPLOS = [
  {
    titulo: "Restaurantes do ABC com segunda chance",
    texto:
      "Todo dia útil às 8h, buscar restaurantes, lanchonetes e bares do ABC Paulista (Santo André, São Bernardo do Campo, São Caetano do Sul, Diadema, Mauá, Ribeirão Pires e Rio Grande da Serra) que tenham celular, sem MEI, até 50 por dia. Mandar WhatsApp. Se o envio falhar, buscar sócios e outro contato da empresa e, se vier um telefone diferente, mandar de novo.",
  },
  {
    titulo: "WhatsApp e depois e-mail",
    texto:
      "Buscar clínicas odontológicas em Campinas pelo CNPJ, mandar WhatsApp e, para quem não responder em 3 dias, mandar e-mail. Quem responder em qualquer canal vai para o funil.",
  },
  {
    titulo: "Maiores primeiro",
    texto:
      "Buscar escritórios de contabilidade em SP. Empresas de pequeno porte passam pelo enriquecimento de sócios antes do WhatsApp; microempresas vão direto para o WhatsApp.",
  },
];

/** Chave do sessionStorage onde a explicação da IA espera o construtor abrir. */
export const chaveExplicacaoIa = (flowId: string) => `fluxo-ia:${flowId}`;

export function CriarFluxoIaDialog() {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [descricao, setDescricao] = useState("");
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function gerar() {
    setGerando(true);
    setErro(null);
    const resp = await fetch("/api/flows/gerar-ia", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ descricao }),
    }).catch(() => null);
    const data = await resp?.json().catch(() => ({}));
    if (!resp?.ok || !data?.id) {
      setGerando(false);
      setErro(data?.error || "Não foi possível montar o fluxo agora. Tente de novo.");
      return;
    }
    try {
      sessionStorage.setItem(chaveExplicacaoIa(data.id), JSON.stringify({ explicacao: data.explicacao, oQueFalta: data.oQueFalta }));
    } catch {
      // sem sessionStorage o fluxo abre sem o resumo; nada se perde
    }
    router.push(`/automacoes/fluxos/${data.id}`);
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => !gerando && setAberto(v)}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><Sparkles className="h-3.5 w-3.5" /> Criar com IA</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Criar fluxo com IA</DialogTitle>
          <DialogDescription>
            Descreva a estratégia do jeito que você explicaria para alguém do time: quem buscar, onde, por qual canal abordar e o que fazer
            se der errado ou se o lead não responder. A IA monta o fluxo e salva pausado para você revisar.
          </DialogDescription>
        </DialogHeader>

        <Textarea
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          rows={7}
          maxLength={4000}
          placeholder="Ex.: buscar restaurantes do ABC Paulista com celular, mandar WhatsApp e, se falhar, buscar outro contato do sócio…"
          disabled={gerando}
          aria-label="Estratégia"
        />

        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium text-muted-foreground">Exemplos</p>
          <div className="flex flex-wrap gap-2">
            {EXEMPLOS.map((ex) => (
              <button
                key={ex.titulo}
                type="button"
                disabled={gerando}
                onClick={() => setDescricao(ex.texto)}
                className="cursor-pointer rounded-full border border-border bg-secondary/40 px-3 py-1.5 text-xs text-foreground transition-colors hover:border-primary/40 hover:bg-accent disabled:opacity-50"
              >
                {ex.titulo}
              </button>
            ))}
          </div>
        </div>

        {erro && <p className="text-sm text-destructive" role="alert">{erro}</p>}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {gerando ? "Montando o fluxo. Costuma levar até 1 minuto." : "Campanhas, funis e planilhas que você já tem são usados quando fizer sentido."}
          </p>
          <Button className="shrink-0 self-end sm:self-auto" onClick={gerar} disabled={gerando || descricao.trim().length < 15}>
            {gerando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {gerando ? "Gerando…" : "Gerar fluxo"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
