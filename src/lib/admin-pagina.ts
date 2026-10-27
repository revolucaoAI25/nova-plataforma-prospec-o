import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/credits";

/**
 * Páginas de /admin: só admin entra (senão volta ao login ou ao início).
 * Cada página chama, além do layout: o layout não roda de novo em toda
 * navegação, então não serve sozinho de proteção. Uma consulta por requisição.
 */
export const paginaSoAdmin = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const profile = await getProfile(supabase, user.id);
  if (!profile || profile.role !== "admin") redirect("/");
  return { supabase, user, profile };
});
