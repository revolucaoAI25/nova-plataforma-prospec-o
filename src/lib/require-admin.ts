import type { SupabaseClient } from "@supabase/supabase-js";
import { getProfile } from "@/lib/credits";

/** Retorna o usuário logado se for admin, ou null. Rotas de admin devem checar e retornar 403 se null. */
export async function requireAdmin(supabase: SupabaseClient, userId: string) {
  const profile = await getProfile(supabase, userId);
  if (!profile || profile.role !== "admin") return null;
  return profile;
}
