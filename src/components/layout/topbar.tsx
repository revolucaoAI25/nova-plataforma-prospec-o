"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, Coins, Plus, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { MobileNav } from "@/components/layout/mobile-nav";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import type { Profile } from "@/lib/database.types";
import { emTesteGratis } from "@/lib/teste-gratis-regras";

export function Topbar({ profile }: { profile: Profile }) {
  const router = useRouter();
  const testeGratis = emTesteGratis(profile);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-4 border-b border-border bg-card/80 px-4 backdrop-blur md:px-8">
      <div className="flex items-center gap-3">
        <MobileNav
          role={profile.role}
          instagramVisible={profile.instagram_visible}
          linkedinVisible={profile.linkedin_visible}
          disparoHabilitado={profile.disparo_habilitado}
          enriquecimentoIaHabilitado={profile.enriquecimento_ia_habilitado}
          bigdatacorpEnrichmentHabilitado={profile.bigdatacorp_enrichment_habilitado}
          emailDisparoHabilitado={profile.email_disparo_habilitado}
          linkedinDisparoHabilitado={profile.linkedin_disparo_habilitado}
          testeGratis={testeGratis}
        />
        <div className="flex items-center gap-2 text-sm">
          <Link
            href="/creditos"
            title="Comprar créditos"
            className="group flex items-center gap-1.5 rounded-full border border-primary/20 bg-accent px-3 py-1 transition-colors hover:border-primary/40"
          >
            <Coins className="h-3.5 w-3.5 text-primary" />
            <span className="font-semibold text-accent-foreground">{profile.creditos}</span>
            <span className="hidden text-muted-foreground sm:inline">créditos</span>
            <Plus className="h-3 w-3 text-primary opacity-0 transition-opacity group-hover:opacity-100" />
          </Link>
          {testeGratis && (
            <Link
              href="/creditos"
              className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Teste grátis ·</span> Assinar
            </Link>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3">
        {/* No desktop (md+) o e-mail já aparece no rodapé da sidebar — evita duplicar. */}
        <span className="hidden text-sm text-muted-foreground sm:inline md:hidden">{profile.email}</span>
        <ThemeToggle />
        <Button variant="ghost" size="icon" onClick={handleLogout} title="Sair">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
