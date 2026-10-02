"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Building2, Compass, Kanban, CalendarClock, Send, Mail, Contact, BrainCircuit, Plug, Lock, MapPin, Search, type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { paginaLiberadaNoTeste } from "@/lib/teste-gratis-regras";

/** O que cada área bloqueada entrega — o texto do convite muda conforme a aba. */
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

function areaDe(pathname: string) {
  return AREAS.find((a) => pathname === a.prefixo || pathname.startsWith(`${a.prefixo}/`));
}

/**
 * Teste grátis: nas páginas fora do que o teste libera (CNPJ, Maps,
 * histórico e conta), mostra o convite para assinar no lugar do conteúdo.
 * As APIs dessas áreas também recusam o acesso (proxy e flags do perfil).
 */
export function PortaoTesteGratis({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (paginaLiberadaNoTeste(pathname)) return <>{children}</>;

  const area = areaDe(pathname);
  const Icone = area?.icone ?? Lock;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 py-6 md:py-12">
      <Card className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-primary opacity-[0.12] blur-3xl" />
        <CardContent className="flex flex-col gap-5 p-6 md:p-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent text-primary">
              <Icone className="h-5 w-5" />
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground">
              <Lock className="h-3 w-3" /> Disponível ao assinar
            </span>
          </div>
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{area?.titulo ?? "Recurso dos planos pagos"}</h1>
            <p className="text-muted-foreground">
              {area?.descricao ?? "Esta área faz parte dos planos pagos da plataforma."}
            </p>
          </div>
          <p className="rounded-2xl border border-border bg-secondary/50 px-4 py-3 text-sm text-muted-foreground">
            A sua conta é de <strong className="font-semibold text-foreground">teste grátis</strong>: dá para extrair empresas por CNPJ e Google Maps e ver os contatos no histórico. Ao assinar um plano, a plataforma inteira é liberada na hora.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/creditos">
                Ver planos <ArrowRight />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/busca/maps">
                <MapPin /> Buscar no Google Maps
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/busca/cnpj">
                <Building2 /> Buscar por CNPJ
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
