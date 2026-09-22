"use client";

import { useEffect, useState } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { buildNavSections } from "./nav-items";
import { SidebarNav } from "./sidebar-nav";
import { Logo } from "./logo";

const STORAGE_KEY = "pa:sidebar-collapsed";

export function Sidebar({
  role,
  instagramVisible,
  disparoHabilitado,
  enriquecimentoIaHabilitado,
}: {
  role: "user" | "admin";
  instagramVisible: boolean;
  disparoHabilitado: boolean;
  enriquecimentoIaHabilitado: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);

  // Lê a preferência salva só após montar — mantém o SSR e o primeiro
  // paint do cliente idênticos (expandido) e evita mismatch de hidratação.
  // (Não dá pra mover isso pra fora do efeito: localStorage não existe no
  // servidor, e ajustar o estado durante a renderização mudaria o HTML já
  // hidratado, o que é o próprio mismatch que este padrão evita.)
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCollapsed(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      // localStorage indisponível (modo privado etc.) — mantém expandido.
    }
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty("--app-sidebar-w", collapsed ? "4.75rem" : "16rem");
    try {
      localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
    } catch {
      // ignora
    }
  }, [collapsed]);

  const sections = buildNavSections({ isAdmin: role === "admin", instagramVisible, disparoHabilitado, enriquecimentoIaHabilitado });

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-20 hidden flex-col border-r border-border bg-card transition-[width] duration-200 md:flex",
        collapsed ? "w-19" : "w-64",
      )}
    >
      <div
        className={cn(
          "flex h-16 items-center gap-2.5 border-b border-border px-6",
          collapsed && "justify-center px-0",
        )}
      >
        <Logo />
        {!collapsed && <span className="truncate font-bold tracking-tight">Revolução AI</span>}
      </div>

      <SidebarNav sections={sections} collapsed={collapsed} />

      <div className="border-t border-border p-3">
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          title={collapsed ? "Expandir menu" : "Recolher menu"}
          className={cn(
            "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
            collapsed && "justify-center px-0",
          )}
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4 shrink-0" /> : <PanelLeftClose className="h-4 w-4 shrink-0" />}
          {!collapsed && "Recolher"}
        </button>
      </div>
    </aside>
  );
}
