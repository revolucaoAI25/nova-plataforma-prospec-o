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
  Settings,
  Users,
  Radio,
  BrainCircuit,
} from "lucide-react";

export interface NavLeaf {
  type: "link";
  href: string;
  label: string;
  icon: LucideIcon;
}

export interface NavGroupNode {
  type: "group";
  label: string;
  icon: LucideIcon;
  children: NavLeaf[];
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
  isAdmin,
  instagramVisible,
  linkedinVisible,
  disparoHabilitado,
  enriquecimentoIaHabilitado,
}: {
  isAdmin: boolean;
  instagramVisible: boolean;
  linkedinVisible: boolean;
  disparoHabilitado: boolean;
  enriquecimentoIaHabilitado: boolean;
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
      items: [{ type: "link", href: "/", label: "Visão geral", icon: LayoutDashboard }],
    },
    {
      label: "Prospecção",
      items: [
        { type: "group", label: "Busca", icon: Search, children: buscaChildren },
        { type: "link", href: "/historico", label: "Histórico", icon: History },
        { type: "link", href: "/automacoes", label: "Automações", icon: CalendarClock },
        ...(enriquecimentoIaHabilitado || isAdmin
          ? [{ type: "link" as const, href: "/enriquecimento", label: "Enriquecimento com IA", icon: BrainCircuit }]
          : []),
      ],
    },
  ];

  if (disparoHabilitado || isAdmin) {
    sections.push({
      label: "Engajamento",
      items: [
        {
          type: "group",
          label: "Disparo WhatsApp",
          icon: Send,
          children: [
            { type: "link", href: "/disparo", label: "Campanhas", icon: MessageSquareText },
            { type: "link", href: "/disparo/solicitar-oficial", label: "Solicitar canal oficial", icon: BadgeCheck },
          ],
        },
      ],
    });
  }

  sections.push({
    label: "Conta",
    items: [{ type: "link", href: "/configuracoes", label: "Configurações", icon: Settings }],
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
