"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Columns3, Crown, Filter, KeyRound, LayoutDashboard, Radio, Users } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { cn } from "@/lib/utils";

/** Seções da área de administração, na ordem do dia a dia: acompanhar, clientes, vendas, catálogo, operação. */
export const SECOES_ADMIN = [
  { href: "/admin", rotulo: "Visão geral", icone: LayoutDashboard, descricao: "Como está a base de clientes, quem vale um contato agora e o consumo das buscas." },
  { href: "/admin/clientes", rotulo: "Clientes", icone: Users, descricao: "Todas as contas: situação, créditos e uso. Abra um cliente para mudar créditos, recursos e condição de preço." },
  { href: "/admin/leads", rotulo: "Leads", icone: Columns3, descricao: "Quem preencheu o formulário da página de vendas, quem está no teste, quem não pagou e quem virou cliente." },
  { href: "/admin/funil-lp", rotulo: "Funil da página", icone: Filter, descricao: "Visitas, cliques e conversões da página de vendas, por etapa e por campanha." },
  { href: "/admin/precos", rotulo: "Planos e preços", icone: Crown, descricao: "Planos, add-ons, pacotes de créditos e quanto cada ação consome." },
  { href: "/admin/disparo", rotulo: "WhatsApp oficial", icone: Radio, descricao: "Conectar o WhatsApp oficial de um cliente, webhook do canal e solicitações antigas." },
  { href: "/admin/configuracoes", rotulo: "Chaves e integrações", icone: KeyRound, descricao: "Chaves dos fornecedores, pagamento, e-mail, Pixel e demais ajustes da plataforma." },
] as const;

function secaoAtiva(pathname: string) {
  const exata = SECOES_ADMIN.find((s) => s.href === pathname);
  if (exata) return { secao: exata, exata: true };
  // Subpáginas (ex.: /admin/<cliente>) contam como Clientes.
  const prefixo = SECOES_ADMIN.find((s) => s.href !== "/admin" && pathname.startsWith(`${s.href}/`));
  return { secao: prefixo ?? SECOES_ADMIN[1], exata: false };
}

/** Cabeçalho e navegação por seções da área de administração. */
export function AdminNav() {
  const pathname = usePathname();
  const { secao, exata } = secaoAtiva(pathname);

  return (
    <div className="flex flex-col gap-5">
      {exata && <PageHeader eyebrow="Administração" title={secao.rotulo} description={secao.descricao} />}
      <nav
        aria-label="Seções da administração"
        className="-mx-4 overflow-x-auto border-b border-border px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden"
      >
        <ul className="flex min-w-max gap-1">
          {SECOES_ADMIN.map((s) => {
            const ativo = s.href === secao.href;
            const Icone = s.icone;
            return (
              <li key={s.href}>
                <Link
                  href={s.href}
                  aria-current={ativo ? "page" : undefined}
                  className={cn(
                    "-mb-px flex h-11 items-center gap-2 whitespace-nowrap border-b-2 px-3 text-sm font-medium transition-colors",
                    ativo ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
                  )}
                >
                  <Icone className={cn("h-4 w-4", ativo ? "text-primary" : "")} />
                  {s.rotulo}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
