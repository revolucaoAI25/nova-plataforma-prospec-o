import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Search,
  Building2,
  MapPin,
  AtSign,
  UserSearch,
  Send,
  MessageSquareText,
  BadgeCheck,
  CalendarClock,
  History,
  Plug,
  Users,
  Radio,
  BrainCircuit,
  Mail,
  Contact,
  Kanban,
  Coins,
  Compass,
  UserRound,
} from "lucide-react";
import { paginaLiberadaNoTeste } from "@/lib/teste-gratis-regras";

export interface NavLeaf {
  type: "link";
  href: string;
  label: string;
  icon: LucideIcon;
  /** Teste grátis: aparece com cadeado e a página mostra o convite para assinar. */
  bloqueado?: boolean;
}

export interface NavGroupNode {
  type: "group";
  label: string;
  icon: LucideIcon;
  children: NavLeaf[];
  bloqueado?: boolean;
}

export type NavNode = NavLeaf | NavGroupNode;

export interface NavSection {
  label?: string;
  items: NavNode[];
}

/**
 * Árvore de navegação única, compartilhada entre a sidebar desktop e o
 * drawer mobile — dá pra crescer (novas fontes de busca, novas seções admin)
 * só adicionando itens/grupos aqui, sem duplicar lógica de highlight/estado.
 */
export function buildNavSections({
  testeGratis = false,
  ...flags
}: Parameters<typeof montarSecoes>[0] & { testeGratis?: boolean }): NavSection[] {
  if (!testeGratis) return montarSecoes(flags);
  // Teste grátis: o menu mostra a plataforma inteira (como num plano completo,
  // sem admin) para a pessoa ver o que ganha ao assinar; o que não é CNPJ,
  // Maps, histórico ou conta fica com cadeado.
  const secoes = montarSecoes({
    isAdmin: false, instagramVisible: true, linkedinVisible: true, disparoHabilitado: true, enriquecimentoIaHabilitado: true,
    bigdatacorpEnrichmentHabilitado: true, emailDisparoHabilitado: true, linkedinDisparoHabilitado: true,
  });
  const marcar = (folha: NavLeaf): NavLeaf => ({ ...folha, bloqueado: !paginaLiberadaNoTeste(folha.href) });
  return secoes.map((secao) => ({
    ...secao,
    items: secao.items.map((item) => {
      if (item.type === "link") return marcar(item);
      const children = item.children.map(marcar);
      return { ...item, children, bloqueado: children.every((c) => c.bloqueado) };
    }),
  }));
}

function montarSecoes({
  isAdmin,
  instagramVisible,
  linkedinVisible,
  disparoHabilitado,
  enriquecimentoIaHabilitado,
  bigdatacorpEnrichmentHabilitado,
  emailDisparoHabilitado,
  linkedinDisparoHabilitado,
}: {
  isAdmin: boolean;
  instagramVisible: boolean;
  linkedinVisible: boolean;
  disparoHabilitado: boolean;
  enriquecimentoIaHabilitado: boolean;
  bigdatacorpEnrichmentHabilitado: boolean;
  emailDisparoHabilitado: boolean;
  linkedinDisparoHabilitado: boolean;
}): NavSection[] {
  const buscaChildren: NavLeaf[] = [
    { type: "link", href: "/busca/cnpj", label: "CNPJ", icon: Building2 },
    { type: "link", href: "/busca/maps", label: "Google Maps", icon: MapPin },
    ...(instagramVisible
      ? [{ type: "link" as const, href: "/busca/instagram", label: "Instagram", icon: AtSign }]
      : []),
    ...(linkedinVisible
      ? [{ type: "link" as const, href: "/busca/linkedin", label: "LinkedIn", icon: UserSearch }]
      : []),
  ];

  const sections: NavSection[] = [
    {
      items: [
        { type: "link", href: "/", label: "Visão geral", icon: LayoutDashboard },
        { type: "link", href: "/onboarding", label: "Estratégia de prospecção", icon: Compass },
      ],
    },
    {
      label: "Prospecção",
      items: [
        { type: "group", label: "Busca", icon: Search, children: buscaChildren },
        { type: "link", href: "/historico", label: "Histórico", icon: History },
        { type: "link", href: "/funil", label: "Funil", icon: Kanban },
        { type: "link", href: "/automacoes", label: "Automações", icon: CalendarClock },
        ...(enriquecimentoIaHabilitado || bigdatacorpEnrichmentHabilitado || isAdmin
          ? [{ type: "link" as const, href: "/enriquecimento", label: "Enriquecimento", icon: BrainCircuit }]
          : []),
      ],
    },
  ];

  const engajamentoItems: NavNode[] = [];
  if (disparoHabilitado || isAdmin) {
    engajamentoItems.push({
      type: "group",
      label: "Disparo WhatsApp",
      icon: Send,
      children: [
        { type: "link", href: "/disparo", label: "Campanhas", icon: MessageSquareText },
        { type: "link", href: "/disparo/solicitar-oficial", label: "Solicitar canal oficial", icon: BadgeCheck },
      ],
    });
  }
  if (emailDisparoHabilitado || isAdmin) {
    // Só uma página (sem canal oficial/QR pra "solicitar") — link direto,
    // não um grupo como o disparo WhatsApp acima.
    engajamentoItems.push({ type: "link", href: "/disparo-email", label: "Disparo E-mail", icon: Mail });
  }
  if (linkedinDisparoHabilitado || isAdmin) {
    engajamentoItems.push({ type: "link", href: "/disparo-linkedin", label: "Disparo LinkedIn", icon: Contact });
  }
  if (engajamentoItems.length) {
    sections.push({ label: "Engajamento", items: engajamentoItems });
  }

  sections.push({
    label: "Conta",
    items: [
      { type: "link", href: "/perfil", label: "Meu perfil", icon: UserRound },
      { type: "link", href: "/creditos", label: "Créditos", icon: Coins },
      { type: "link", href: "/conexoes", label: "Conexões", icon: Plug },
    ],
  });

  if (isAdmin) {
    sections.push({
      label: "Administração",
      items: [
        { type: "link", href: "/admin", label: "Usuários", icon: Users },
        { type: "link", href: "/admin/disparo", label: "Canal oficial", icon: Radio },
      ],
    });
  }

  return sections;
}
