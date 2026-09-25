"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { buildNavSections } from "./nav-items";
import { SidebarNav } from "./sidebar-nav";
import { Logo } from "./logo";

/** Sidebar não aparece abaixo de md — sem isso não havia NENHUMA forma de navegar no mobile. */
export function MobileNav({
  role,
  instagramVisible,
  linkedinVisible,
  disparoHabilitado,
  enriquecimentoIaHabilitado,
  emailDisparoHabilitado,
}: {
  role: "user" | "admin";
  instagramVisible: boolean;
  linkedinVisible: boolean;
  disparoHabilitado: boolean;
  enriquecimentoIaHabilitado: boolean;
  emailDisparoHabilitado: boolean;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Fecha o drawer quando a rota muda — ajuste durante a renderização (não em
  // efeito) para não disparar um render extra a cada navegação.
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const sections = buildNavSections({
    isAdmin: role === "admin", instagramVisible, linkedinVisible, disparoHabilitado, enriquecimentoIaHabilitado, emailDisparoHabilitado,
  });

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-foreground transition-colors hover:bg-secondary md:hidden"
        aria-label="Abrir menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="animate-fade-in absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="animate-slide-in-left relative flex h-full w-72 max-w-[85vw] flex-col border-r border-border bg-card">
            <div className="flex h-16 items-center justify-between border-b border-border px-5">
              <div className="flex items-center gap-2.5">
                <Logo />
                <span className="font-bold tracking-tight">Revolução AI</span>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                aria-label="Fechar menu"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <SidebarNav sections={sections} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
