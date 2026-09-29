"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

type Tema = "light" | "dark";

function temaEfetivo(): Tema {
  const salvo = document.documentElement.getAttribute("data-theme");
  if (salvo === "light" || salvo === "dark") return salvo;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

/**
 * Alterna entre claro/escuro e persiste a escolha em localStorage — o
 * script inline em src/app/layout.tsx lê esse mesmo valor antes do 1º
 * paint pra não piscar (FOUC). Antes de qualquer clique, o app segue a
 * preferência do sistema operacional (ver @media prefers-color-scheme em
 * globals.css); depois do 1º clique, a escolha do usuário manda sempre.
 */
export function ThemeToggle() {
  const [tema, setTema] = useState<Tema | null>(null);

  // Lê o tema efetivo só após montar (localStorage/matchMedia não existem
  // no servidor) — mesmo padrão de src/components/layout/sidebar.tsx.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTema(temaEfetivo());
  }, []);

  function alternar() {
    const novo: Tema = temaEfetivo() === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", novo);
    try {
      localStorage.setItem("theme", novo);
    } catch {
      // localStorage indisponível (modo privado etc.) — tema não persiste
      // entre sessões, mas continua funcionando na aba atual.
    }
    setTema(novo);
  }

  // Evita mismatch de hidratação: só sabe o tema efetivo depois do mount
  // (o servidor não tem acesso a localStorage/matchMedia do cliente).
  if (tema === null) return <div className="h-9 w-9" aria-hidden="true" />;

  return (
    <Button variant="ghost" size="icon" onClick={alternar} title={tema === "dark" ? "Mudar para modo claro" : "Mudar para modo escuro"}>
      {tema === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
