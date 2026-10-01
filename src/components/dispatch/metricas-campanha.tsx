"use client";

import { useEffect, useState } from "react";
import { FlaskConical, Info, Loader2, Trophy } from "lucide-react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { Contagem, MetricasCampanha, CanalMetricas } from "@/lib/metricas-disparo";

function pct(parte: number, todo: number) {
  if (!todo) return "—";
  return `${((parte / todo) * 100).toFixed(1).replace(".", ",").replace(",0", "")}%`;
}

const COMO_LIGAR_RECIBOS: Record<CanalMetricas, string> = {
  whatsapp: "Entregue/lido aparecem quando o número está conectado e o webhook foi registrado (automático em até 2 minutos depois de conectar). No canal oficial, depende do webhook da Meta configurado no app. Quem desligou a confirmação de leitura no WhatsApp nunca aparece como lido.",
  email: "Entregue/aberto/clicado aparecem quando o webhook de e-mail está configurado no provedor (veja o README). Abertura é aproximada: alguns clientes de e-mail bloqueiam a imagem de rastreio, outros abrem sozinhos.",
  linkedin: "Lido aparece quando o webhook de mensagens está registrado na conta conectada. O LinkedIn não informa leitura de nota de convite, só de mensagem.",
};

function linhasFunil(c: Contagem, canal: CanalMetricas) {
  const linhas: Array<{ rotulo: string; valor: number }> = [{ rotulo: canal === "linkedin" ? "Abordados" : "Receberam", valor: c.alvos }];
  if (canal === "linkedin") linhas.push({ rotulo: "Aceitaram o convite", valor: c.aceitaram });
  linhas.push({ rotulo: "Entregue", valor: c.entregues });
  linhas.push({ rotulo: canal === "email" ? "Abriram" : "Leram", valor: c.lidos });
  if (canal === "email") linhas.push({ rotulo: "Clicaram", valor: c.clicados });
  linhas.push({ rotulo: "Responderam", valor: c.responderam });
  return linhas;
}

/**
 * Funil de resultado da campanha, comparação A/B e desempenho por etapa.
 * O que importa é resposta, não envio: por isso a resposta fica em destaque
 * e cada etapa mostra quantas respostas vieram depois dela.
 */
export function MetricasCampanhaPanel({ url, canal }: { url: string; canal: CanalMetricas }) {
  const [dados, setDados] = useState<MetricasCampanha | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let vivo = true;
    // Busca disparada pela troca de campanha (url) — assíncrona, não dá pra derivar na renderização.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCarregando(true);
    fetch(url).then((r) => r.json()).then((d) => {
      if (!vivo) return;
      setDados(d.metricas ?? null);
      setCarregando(false);
    }).catch(() => vivo && setCarregando(false));
    return () => { vivo = false; };
  }, [url]);

  if (carregando) return <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Calculando resultados…</p>;
  if (!dados || !dados.total.alvos) return <p className="text-sm text-muted-foreground">Os resultados aparecem aqui depois dos primeiros envios.</p>;

  const funil = linhasFunil(dados.total, canal);
  const v = dados.vencedor;

  return (
    <div className="flex flex-col gap-5">
      <section aria-label="Funil da campanha" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {funil.map((l, i) => (
          <div key={l.rotulo} className={cn("flex flex-col gap-1 rounded-xl border border-border bg-card p-3", l.rotulo === "Responderam" && "border-primary/40 bg-accent/30")}>
            <span className="text-xs text-muted-foreground">{l.rotulo}</span>
            <span className="text-xl font-semibold tabular-nums text-foreground">{l.valor.toLocaleString("pt-BR")}</span>
            {i > 0 && <span className="text-xs tabular-nums text-muted-foreground">{pct(l.valor, dados.total.alvos)} de quem recebeu</span>}
          </div>
        ))}
      </section>

      {canal === "email" && dados.total.devolvidos > 0 && (
        <p className="text-sm text-amber">
          {dados.total.devolvidos} e-mail{dados.total.devolvidos === 1 ? "" : "s"} devolvido{dados.total.devolvidos === 1 ? "" : "s"} ou marcado{dados.total.devolvidos === 1 ? "" : "s"} como spam ({pct(dados.total.devolvidos, dados.total.alvos)}). Acima de 2% a reputação do domínio cai: limpe a lista ou reduza o volume. Esses endereços já entraram no descadastro.
        </p>
      )}

      {!dados.temRecibos && (
        <p className="flex items-start gap-2 rounded-lg bg-secondary/40 p-3 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> <span>Nenhum status de entrega/leitura chegou ainda. {COMO_LIGAR_RECIBOS[canal]}</span>
        </p>
      )}

      {dados.testeAtivo && (
        <section aria-label="Teste A/B" className="flex flex-col gap-3 rounded-xl border border-border p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground"><FlaskConical className="h-4 w-4 text-primary" /> Teste A/B</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Versão</TableHead>
                <TableHead className="text-right">Leads</TableHead>
                {canal === "linkedin" && <TableHead className="text-right">Aceite</TableHead>}
                <TableHead className="text-right">{canal === "email" ? "Abertura" : "Leitura"}</TableHead>
                <TableHead className="text-right">Resposta</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(["A", "B"] as const).map((k) => {
                const c = dados.variantes[k];
                return (
                  <TableRow key={k}>
                    <TableCell className="font-medium">
                      <span className="flex items-center gap-1.5">{k} {v?.variante === k && <Trophy className="h-3.5 w-3.5 text-amber" aria-label="Versão vencedora" />}</span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{c.alvos}</TableCell>
                    {canal === "linkedin" && <TableCell className="text-right tabular-nums">{pct(c.aceitaram, c.alvos)}</TableCell>}
                    <TableCell className="text-right tabular-nums">{pct(c.lidos, c.alvos)}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{pct(c.responderam, c.alvos)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {v && <p className="text-sm text-muted-foreground">{v.texto}</p>}
        </section>
      )}

      {dados.etapas.length > 0 && (
        <section aria-label="Resultado por etapa" className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-foreground">Por etapa da cadência</h3>
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Etapa</TableHead>
                <TableHead className="text-right">Envios</TableHead>
                <TableHead className="text-right">Entregues</TableHead>
                <TableHead className="text-right">{canal === "email" ? "Abertos" : "Lidos"}</TableHead>
                <TableHead className="text-right" title="Respostas que chegaram depois desta etapa (antes da próxima)">Respostas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dados.etapas.map((e) => (
                <TableRow key={e.ordem}>
                  <TableCell className="font-medium">{e.ordem}</TableCell>
                  <TableCell className="text-right tabular-nums">{e.envios}</TableCell>
                  <TableCell className="text-right tabular-nums">{pct(e.entregues, e.envios)}</TableCell>
                  <TableCell className="text-right tabular-nums">{pct(e.lidos, e.envios)}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{e.respostasDepois}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
          <p className="text-xs text-muted-foreground">A coluna Respostas conta quem respondeu depois daquela etapa. Etapa que quase não gera resposta é candidata a ser reescrita ou cortada.</p>
        </section>
      )}
    </div>
  );
}
