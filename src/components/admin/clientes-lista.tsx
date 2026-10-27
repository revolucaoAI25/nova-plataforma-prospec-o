"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SituacaoBadge } from "@/components/admin/situacao-badge";
import { formatarExibicao } from "@/lib/phone";
import { cn } from "@/lib/utils";
import type { FiltroSituacao, Situacao } from "@/lib/admin-clientes";

export interface ClienteLinha {
  id: string;
  email: string;
  nome: string | null;
  empresa: string | null;
  telefone: string | null;
  situacao: Situacao;
  creditos: number;
  totalBuscas: number;
  totalLeads: number;
  ultimaBusca: string | null;
  criadoEm: string;
}

const FILTROS: [FiltroSituacao | "todos", string][] = [
  ["todos", "Todos"],
  ["assinante", "Assinantes"],
  ["teste", "Em teste"],
  ["atencao", "Precisa de atenção"],
  ["sem_plano", "Sem plano"],
  ["interno", "Internos"],
];

const data = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: "America/Sao_Paulo" }) : "—";
const fmt = (n: number) => n.toLocaleString("pt-BR");

/** Lista de contas com busca e filtro por situação; a edição fica na página de cada cliente. */
export function ClientesLista({ clientes, filtroInicial }: { clientes: ClienteLinha[]; filtroInicial: FiltroSituacao | "todos" }) {
  const router = useRouter();
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState(filtroInicial);

  const contagem = useMemo(() => {
    const c: Record<string, number> = { todos: clientes.length };
    for (const cl of clientes) c[cl.situacao.filtro] = (c[cl.situacao.filtro] ?? 0) + 1;
    return c;
  }, [clientes]);

  const termo = busca.trim().toLowerCase();
  const digitos = termo.replace(/\D/g, "");
  const visiveis = clientes.filter(
    (c) =>
      (filtro === "todos" || c.situacao.filtro === filtro) &&
      (!termo ||
        [c.nome, c.email, c.empresa].join(" ").toLowerCase().includes(termo) ||
        (digitos.length >= 4 && (c.telefone ?? "").includes(digitos))),
  );

  function escolherFiltro(f: FiltroSituacao | "todos") {
    setFiltro(f);
    // Mantém o filtro no endereço (voltar da página do cliente cai no mesmo recorte).
    router.replace(f === "todos" ? "/admin/clientes" : `/admin/clientes?situacao=${f}`, { scroll: false });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, e-mail, empresa ou telefone"
            className="pl-9"
            aria-label="Buscar cliente"
          />
        </div>
        <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
          <div className="inline-flex min-w-max rounded-lg border border-border bg-card p-1" role="group" aria-label="Situação">
            {FILTROS.map(([valor, rotulo]) => (
              <button
                key={valor}
                type="button"
                onClick={() => escolherFiltro(valor)}
                aria-pressed={filtro === valor}
                className={cn(
                  "flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  filtro === valor ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {rotulo}
                <span className={cn("text-xs tabular-nums", filtro === valor ? "opacity-80" : "text-muted-2")}>{contagem[valor] ?? 0}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {visiveis.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Nenhum cliente {termo ? "encontrado com essa busca" : "nessa situação"}.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead className="text-right">Créditos</TableHead>
              <TableHead className="text-right">Buscas</TableHead>
              <TableHead className="text-right">Leads</TableHead>
              <TableHead>Última busca</TableHead>
              <TableHead>Conta criada</TableHead>
              <TableHead className="w-10"><span className="sr-only">Abrir</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visiveis.map((c) => (
              <TableRow key={c.id} className="cursor-pointer" onClick={() => router.push(`/admin/${c.id}`)}>
                <TableCell className="max-w-[280px]">
                  <Link href={`/admin/${c.id}`} className="flex min-w-0 flex-col gap-0.5" onClick={(e) => e.stopPropagation()}>
                    <span className="truncate font-medium text-foreground" title={c.nome || c.email}>{c.nome || c.email}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {[c.nome ? c.email : null, c.empresa, c.telefone && formatarExibicao(c.telefone)].filter(Boolean).join(" · ") || "—"}
                    </span>
                  </Link>
                </TableCell>
                <TableCell><SituacaoBadge situacao={c.situacao} /></TableCell>
                <TableCell className="text-right tabular-nums">{fmt(c.creditos)}</TableCell>
                <TableCell className="text-right tabular-nums">{fmt(c.totalBuscas)}</TableCell>
                <TableCell className="text-right tabular-nums">{fmt(c.totalLeads)}</TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">{data(c.ultimaBusca)}</TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">{data(c.criadoEm)}</TableCell>
                <TableCell><ChevronRight className="h-4 w-4 text-muted-foreground" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <p className="text-xs text-muted-foreground">
        {fmt(visiveis.length)} de {fmt(clientes.length)} contas. Clique em uma para ajustar créditos, recursos liberados e condição de preço.
      </p>
    </div>
  );
}
