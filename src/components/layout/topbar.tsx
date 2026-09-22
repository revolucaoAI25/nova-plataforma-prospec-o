"use client";

import { useRouter } from "next/navigation";
import { LogOut, Building2, MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { MobileNav } from "@/components/layout/mobile-nav";
import type { Profile } from "@/lib/database.types";

export function Topbar({ profile }: { profile: Profile }) {
  const router = useRouter();

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
          disparoHabilitado={profile.disparo_habilitado}
          enriquecimentoIaHabilitado={profile.enriquecimento_ia_habilitado}
        />
        <div className="flex items-center gap-2 text-sm">
          <div className="flex items-center gap-1.5 rounded-full border border-primary/20 bg-accent px-3 py-1">
            <Building2 className="h-3.5 w-3.5 text-primary" />
            <span className="font-semibold text-accent-foreground">{profile.cdd_credits}</span>
            <span className="hidden text-muted-foreground sm:inline">créditos CNPJ</span>
          </div>
          {profile.maps_credits_enabled && (
            <div className="flex items-center gap-1.5 rounded-full border border-primary/20 bg-accent px-3 py-1">
              <MapPin className="h-3.5 w-3.5 text-primary" />
              <span className="font-semibold text-accent-foreground">{profile.maps_credits}</span>
              <span className="hidden text-muted-foreground sm:inline">créditos Maps</span>
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3">
        {/* No desktop (md+) o e-mail já aparece no rodapé da sidebar — evita duplicar. */}
        <span className="hidden text-sm text-muted-foreground sm:inline md:hidden">{profile.email}</span>
        <Button variant="ghost" size="icon" onClick={handleLogout} title="Sair">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
