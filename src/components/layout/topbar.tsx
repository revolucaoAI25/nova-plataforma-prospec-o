"use client";

import { useRouter } from "next/navigation";
import { LogOut, Building2, MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
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
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1">
          <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-medium">{profile.cdd_credits}</span>
          <span className="hidden text-muted-foreground sm:inline">créditos CNPJ</span>
        </div>
        {profile.maps_credits_enabled && (
          <div className="flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1">
            <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-medium">{profile.maps_credits}</span>
            <span className="hidden text-muted-foreground sm:inline">créditos Maps</span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-3">
        <span className="hidden text-sm text-muted-foreground sm:inline">{profile.email}</span>
        <Button variant="ghost" size="icon" onClick={handleLogout} title="Sair">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
