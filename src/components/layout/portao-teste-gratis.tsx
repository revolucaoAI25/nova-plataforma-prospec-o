"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Building2, Compass, Kanban, CalendarClock, Send, Mail, Contact, BrainCircuit, Plug, Lock, MapPin, Search, Eye, Sparkles, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { acaoBloqueadaNaVisualizacao, MSG_TESTE_GRATIS, paginaLiberadaNoTeste, type SituacaoTeste } from "@/lib/teste-gratis-regras";
import { OfertaTeste, TesteEncerrado, textoDiasRestantes, type MotivoOferta } from "@/components/layout/oferta-teste";

/**
 * O que cada área entrega — o texto da faixa e do aviso muda conforme a aba.
 * `convite`: a área não abre nem em visualização (o questionário da
 * estratégia por IA, por exemplo); mostra só o convite para assinar.
 */
const AREAS: { prefixo: string; titulo: string; descricao: string; icone: LucideIcon; convite?: boolean }[] = [
  { prefixo: "/onboarding", titulo: "Estratégia de prospecção criada por IA", descricao: "A IA analisa o seu negócio e monta o público, as mensagens e a cadência de cada canal.", icone: Compass, convite: true },
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

const PADRAO: (typeof AREAS)[number] = { prefixo: "", titulo: "Esta área", descricao: "Ela faz parte dos planos pagos da plataforma.", icone: Lock };

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

/** Páginas que continuam abertas com o teste vencido: é por elas que a pessoa assina. */
const ABERTAS_APOS_TESTE = ["/creditos", "/perfil"];

const CHAVE_OFERTA_DIA = "lm_oferta_teste_dia";
const CHAVE_OFERTA_BUSCA = "lm_oferta_apos_busca";

function hojeLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/** O tour guiado está aberto: a oferta espera ele fechar. */
function tourAberto(): boolean {
  return document.documentElement.dataset.tour === "aberto";
}

/**
 * Tudo o que o teste grátis mostra em volta das páginas:
 *
 * - Páginas fora do que o teste usa de verdade (CNPJ, Maps, histórico e
 *   conta) abrem em modo de visualização: dá para navegar e abrir as telas,
 *   mas qualquer ação (salvar, enviar, conectar) é barrada antes de sair e
 *   abre o convite para assinar. O servidor recusa essas ações por conta
 *   própria (proxy e flags do perfil); isto aqui é a experiência clara.
 * - Uma barra fixa com o prazo, os créditos e o botão de assinar, em toda tela.
 * - A oferta nos momentos de decisão: créditos esgotados, último dia, volta
 *   à plataforma (uma vez por dia) e depois da primeira busca.
 * - Com o prazo vencido, a oferta toma o lugar das páginas (menos planos e perfil).
 */
export function PortaoTesteGratis({
  children, creditos, teste, precoMinimo,
}: {
  children: React.ReactNode;
  creditos: number;
  teste: SituacaoTeste;
  precoMinimo: number | null;
}) {
  const pathname = usePathname();
  const visualizacao = !paginaLiberadaNoTeste(pathname);
  const area = areaDe(pathname);
  const [avisoAberto, setAvisoAberto] = useState(false);
  const [oferta, setOferta] = useState<MotivoOferta | null>(null);
  const visualizacaoRef = useRef(visualizacao);
  useEffect(() => {
    visualizacaoRef.current = visualizacao;
  }, [visualizacao]);

  // Um único interceptador, instalado uma vez: bloqueia ações no modo de
  // visualização e percebe, nas buscas, quando o saldo ou o prazo acabam.
  useEffect(() => {
    const fetchOriginal = window.fetch;
    let timerBusca: ReturnType<typeof setTimeout> | null = null;

    window.fetch = async (entrada, init) => {
      const url = entrada instanceof Request ? entrada.url : String(entrada);
      const metodo = (init?.method ?? (entrada instanceof Request ? entrada.method : "GET")).toUpperCase();
      const caminho = caminhoDe(url);
      if (visualizacaoRef.current && caminho && acaoBloqueadaNaVisualizacao(caminho, metodo)) {
        setAvisoAberto(true);
        return new Response(JSON.stringify({ error: MSG_TESTE_GRATIS, testeGratis: true }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        });
      }
      const resposta = await fetchOriginal(entrada, init);
      if (caminho?.startsWith("/api/search/") && metodo !== "GET") {
        if (resposta.status === 402 || resposta.status === 403) {
          const corpo = await resposta.clone().json().catch(() => null);
          if (corpo?.testeGratis) setOferta(corpo.encerrado ? "encerrado" : "sem_creditos");
        } else if (resposta.ok && !timerBusca) {
          // Depois da primeira busca do teste: mostra o que falta (abordar), uma vez só.
          try {
            if (!localStorage.getItem(CHAVE_OFERTA_BUSCA)) {
              timerBusca = setTimeout(() => {
                if (tourAberto()) return;
                try { localStorage.setItem(CHAVE_OFERTA_BUSCA, "1"); } catch {}
                setOferta((atual) => atual ?? "apos_busca");
              }, 25_000);
            }
          } catch {}
        }
      }
      return resposta;
    };

    // Links e formulários que vão direto para a API (ex.: conectar o Google).
    const aoClicar = (e: MouseEvent) => {
      if (!visualizacaoRef.current) return;
      const link = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      const caminho = link ? caminhoDe(link.href) : null;
      if (caminho && acaoBloqueadaNaVisualizacao(caminho, "GET")) {
        e.preventDefault();
        e.stopPropagation();
        setAvisoAberto(true);
      }
    };
    const aoEnviar = (e: SubmitEvent) => {
      if (!visualizacaoRef.current) return;
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
      if (timerBusca) clearTimeout(timerBusca);
      document.removeEventListener("click", aoClicar, true);
      document.removeEventListener("submit", aoEnviar, true);
    };
  }, []);

  // Volta à plataforma: a oferta aparece uma vez por dia (não no primeiro dia,
  // quando a pessoa está conhecendo e vê o tour), e sempre que o saldo zerou
  // ou é o último dia. Espera o tour fechar, se ele estiver aberto.
  useEffect(() => {
    if (teste.expirado) return;
    const primeiroDia = teste.diasRestantes !== null && teste.diasRestantes >= teste.dias - 1;
    const motivo: MotivoOferta | null =
      creditos <= 0 ? "sem_creditos" : teste.diasRestantes === 0 ? "ultimo_dia" : primeiroDia ? null : "retorno";
    if (!motivo) return;
    try {
      if (localStorage.getItem(CHAVE_OFERTA_DIA) === hojeLocal()) return;
    } catch {}
    const mostrar = () => {
      if (tourAberto()) return;
      try { localStorage.setItem(CHAVE_OFERTA_DIA, hojeLocal()); } catch {}
      setOferta((atual) => atual ?? motivo);
    };
    const timer = setTimeout(mostrar, 10_000);
    window.addEventListener("tour:fechado", mostrar);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("tour:fechado", mostrar);
    };
    // Só na entrada (o layout não remonta ao navegar entre páginas).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ofertaJanela = (
    <OfertaTeste motivo={oferta} diasRestantes={teste.diasRestantes} precoMinimo={precoMinimo} aoFechar={() => setOferta(null)} />
  );

  if (teste.expirado && !ABERTAS_APOS_TESTE.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return <TesteEncerrado precoMinimo={precoMinimo} />;
  }
  if (visualizacao && area.convite) return <ConviteAssinatura area={area} creditos={creditos} />;

  const prazo = textoDiasRestantes(teste.diasRestantes);
  const Icone = area.icone;
  return (
    <>
      <div className="sticky top-16 z-[9] -mx-4 -mt-4 mb-6 border-b border-primary/25 bg-accent/95 px-4 py-3 backdrop-blur md:-mx-8 md:-mt-8 md:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex min-w-0 items-start gap-2.5 text-sm text-accent-foreground">
            {visualizacao ? <Eye className="mt-0.5 h-4 w-4 shrink-0" /> : <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />}
            {visualizacao ? (
              <span>
                <strong className="font-semibold">Modo de visualização.</strong>{" "}
                {area.titulo} faz parte dos planos pagos: explore à vontade, e assine para usar.
                {prazo && <span className="text-muted-foreground"> · Teste grátis: {prazo}</span>}
              </span>
            ) : teste.expirado ? (
              <span><strong className="font-semibold">O seu teste grátis terminou.</strong> Escolha um plano para continuar de onde parou.</span>
            ) : (
              <span>
                <strong className="font-semibold">Teste grátis{prazo ? `: ${prazo}` : ""}.</strong>{" "}
                Você tem {creditos.toLocaleString("pt-BR")} créditos para buscar empresas. Assine para a IA abordar essas empresas por você.
              </span>
            )}
          </p>
          <Button asChild size="sm">
            <Link href="/creditos">
              {visualizacao ? "Ver planos" : "Assinar agora"} <ArrowRight />
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
              {area.descricao}{" "}
              {creditos > 0
                ? "No teste grátis você pode conhecer a tela, e a extração por CNPJ e Google Maps funciona de verdade. Ao assinar, tudo é liberado na hora."
                : "No teste grátis você conhece a tela; ao assinar, tudo é liberado na hora."}
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

      {ofertaJanela}
    </>
  );
}

/** Tela de convite para assinar, no lugar do conteúdo (áreas com `convite`). */
function ConviteAssinatura({ area, creditos }: { area: (typeof AREAS)[number]; creditos: number }) {
  const Icone = area.icone;
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
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{area.titulo}</h1>
            <p className="text-muted-foreground">{area.descricao}</p>
          </div>
          <p className="rounded-2xl border border-border bg-secondary/50 px-4 py-3 text-sm text-muted-foreground">
            A sua conta é de <strong className="font-semibold text-foreground">teste grátis</strong>:{" "}
            {creditos > 0
              ? "dá para extrair empresas por CNPJ e Google Maps e ver os contatos no histórico."
              : "dá para navegar pelas telas e conhecer como a plataforma funciona."}{" "}
            Ao assinar um plano, a plataforma inteira é liberada na hora.
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
