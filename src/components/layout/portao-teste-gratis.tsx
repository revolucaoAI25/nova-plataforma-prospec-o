"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Compass, Kanban, CalendarClock, Send, Mail, Contact, BrainCircuit, Plug, Lock, Search, Eye, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { acaoBloqueadaNaVisualizacao, MSG_TESTE_GRATIS, paginaLiberadaNoTeste } from "@/lib/teste-gratis-regras";

/** O que cada área entrega — o texto da faixa e do aviso muda conforme a aba. */
const AREAS: { prefixo: string; titulo: string; descricao: string; icone: LucideIcon }[] = [
  { prefixo: "/onboarding", titulo: "Estratégia de prospecção criada por IA", descricao: "A IA analisa o seu negócio e monta o público, as mensagens e a cadência de cada canal.", icone: Compass },
  { prefixo: "/funil", titulo: "Funil de vendas", descricao: "Cada contato abordado entra no funil e avança sozinho quando responde.", icone: Kanban },
  { prefixo: "/automacoes", titulo: "Automações e cadências", descricao: "Fluxos que buscam, enriquecem e abordam novas empresas todos os dias, sem você precisar repetir o processo.", icone: CalendarClock },
  { prefixo: "/disparo-email", titulo: "Disparo por e-mail", descricao: "Sequências de e-mail com domínio próprio, teste A/B e acompanhamento de abertura e resposta.", icone: Mail },
  { prefixo: "/disparo-linkedin", titulo: "Disparo por LinkedIn", descricao: "Convites e mensagens para os decisores, com limites seguros para a sua conta.", icone: Contact },
  { prefixo: "/disparo", titulo: "Disparo por WhatsApp", descricao: "Abordagem pelo seu número, com ritmo humano, janela de envio e aviso quando alguém responde.", icone: Send },
  { prefixo: "/enriquecimento", titulo: "Enriquecimento e contato do decisor", descricao: "Descubra quem decide em cada empresa e complete os dados de contato antes da abordagem.", icone: BrainCircuit },
  { prefixo: "/busca/instagram", titulo: "Leads do Instagram", descricao: "Encontre perfis comerciais do seu nicho e cidade.", icone: Search },
  { prefixo: "/busca/linkedin", titulo: "Leads do LinkedIn", descricao: "Encontre profissionais pelo cargo, setor e região.", icone: Search },
  { prefixo: "/conexoes", titulo: "Conexões", descricao: "Conecte WhatsApp, e-mail, LinkedIn e Google Sheets à plataforma.", icone: Plug },
];

const PADRAO = { titulo: "Esta área", descricao: "Ela faz parte dos planos pagos da plataforma.", icone: Lock };

function areaDe(pathname: string) {
  return AREAS.find((a) => pathname === a.prefixo || pathname.startsWith(`${a.prefixo}/`)) ?? PADRAO;
}

function caminhoDe(alvo: string): string | null {
  try {
    const url = new URL(alvo, window.location.href);
    return url.origin === window.location.origin ? url.pathname : null;
  } catch {
    return null;
  }
}

/**
 * Teste grátis: as páginas fora do que o teste usa de verdade (CNPJ, Maps,
 * histórico e conta) abrem em modo de visualização. A pessoa navega, abre
 * abas e formulários para conhecer a plataforma, mas qualquer ação (salvar,
 * enviar, conectar) é barrada antes de sair e abre o convite para assinar.
 * O servidor recusa essas ações por conta própria (proxy e flags do perfil);
 * isto aqui é só para a experiência ser clara em vez de mostrar erros soltos.
 */
export function PortaoTesteGratis({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const visualizacao = !paginaLiberadaNoTeste(pathname);
  const area = areaDe(pathname);
  const [avisoAberto, setAvisoAberto] = useState(false);

  useEffect(() => {
    if (!visualizacao) return;
    const fetchOriginal = window.fetch;

    window.fetch = (entrada, init) => {
      const url = entrada instanceof Request ? entrada.url : String(entrada);
      const metodo = init?.method ?? (entrada instanceof Request ? entrada.method : "GET");
      const caminho = caminhoDe(url);
      if (caminho && acaoBloqueadaNaVisualizacao(caminho, metodo)) {
        setAvisoAberto(true);
        return Promise.resolve(
          new Response(JSON.stringify({ error: MSG_TESTE_GRATIS, testeGratis: true }), {
            status: 403,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }
      return fetchOriginal(entrada, init);
    };

    // Links e formulários que vão direto para a API (ex.: conectar o Google).
    const aoClicar = (e: MouseEvent) => {
      const link = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      const caminho = link ? caminhoDe(link.href) : null;
      if (caminho && acaoBloqueadaNaVisualizacao(caminho, "GET")) {
        e.preventDefault();
        e.stopPropagation();
        setAvisoAberto(true);
      }
    };
    const aoEnviar = (e: SubmitEvent) => {
      const form = e.target as HTMLFormElement | null;
      const destino = form?.getAttribute("action");
      const caminho = destino ? caminhoDe(destino) : null;
      if (caminho && acaoBloqueadaNaVisualizacao(caminho, form?.method || "GET")) {
        e.preventDefault();
        setAvisoAberto(true);
      }
    };
    document.addEventListener("click", aoClicar, true);
    document.addEventListener("submit", aoEnviar, true);

    return () => {
      window.fetch = fetchOriginal;
      document.removeEventListener("click", aoClicar, true);
      document.removeEventListener("submit", aoEnviar, true);
    };
  }, [visualizacao]);

  if (!visualizacao) return <>{children}</>;

  const Icone = area.icone;
  return (
    <>
      <div className="sticky top-16 z-[9] -mx-4 -mt-4 mb-6 border-b border-primary/25 bg-accent/95 px-4 py-3 backdrop-blur md:-mx-8 md:-mt-8 md:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex min-w-0 items-start gap-2.5 text-sm text-accent-foreground">
            <Eye className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <strong className="font-semibold">Modo de visualização.</strong>{" "}
              {area.titulo} faz parte dos planos pagos: explore à vontade, e assine para usar.
            </span>
          </p>
          <Button asChild size="sm">
            <Link href="/creditos">
              Ver planos <ArrowRight />
            </Link>
          </Button>
        </div>
      </div>

      {children}

      <Dialog open={avisoAberto} onOpenChange={setAvisoAberto}>
        <DialogContent>
          <DialogHeader>
            <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-2xl bg-accent text-primary">
              <Icone className="h-5 w-5" />
            </div>
            <DialogTitle>{area.titulo} é dos planos pagos</DialogTitle>
            <DialogDescription>
              {area.descricao} No teste grátis você pode conhecer a tela, e a extração por CNPJ e Google Maps funciona de verdade. Ao assinar, tudo é liberado na hora.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAvisoAberto(false)}>Continuar explorando</Button>
            <Button asChild>
              <Link href="/creditos" onClick={() => setAvisoAberto(false)}>
                Ver planos <ArrowRight />
              </Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
