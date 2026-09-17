"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Building2, MapPin, AtSign, History, Settings,
  ShieldCheck, Send, CalendarClock,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
}

const NAV_BASE: NavItem[] = [
  { href: "/", label: "Visão geral", icon: LayoutDashboard },
  { href: "/busca/cnpj", label: "Busca CNPJ", icon: Building2 },
  { href: "/busca/maps", label: "Busca Google Maps", icon: MapPin },
];

const NAV_END: NavItem[] = [
  { href: "/historico", label: "Histórico", icon: History },
  { href: "/automacoes", label: "Automações", icon: CalendarClock },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];

export function Sidebar({
  role,
  instagramVisible,
  disparoHabilitado,
}: {
  role: "user" | "admin";
  instagramVisible: boolean;
  disparoHabilitado: boolean;
}) {
  const pathname = usePathname();
  const isAdmin = role === "admin";

  const nav: NavItem[] = [
    ...NAV_BASE,
    ...(instagramVisible ? [{ href: "/busca/instagram", label: "Busca Instagram", icon: AtSign }] : []),
    ...(disparoHabilitado || isAdmin ? [{ href: "/disparo", label: "Disparo WhatsApp", icon: Send }] : []),
    ...NAV_END,
  ];

  return (
    <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-border bg-card md:flex">
      <div className="flex h-16 items-center gap-2.5 border-b border-border px-6">
        <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground shadow-[0_0_0_1px_rgba(0,200,83,0.4),0_4px_16px_-4px_rgba(0,200,83,0.6)]">
          R
        </div>
        <span className="font-bold tracking-tight">Revolução AI</span>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {nav.map((item) => {
          const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-primary" />
              )}
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
        {isAdmin && (
          <Link
            href="/admin"
            className={cn(
              "relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
              pathname.startsWith("/admin")
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
          >
            {pathname.startsWith("/admin") && (
              <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-primary" />
            )}
            <ShieldCheck className="h-4 w-4" />
            Administração
          </Link>
        )}
      </nav>
    </aside>
  );
}
