import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/credits";
import { InstagramSearchForm } from "@/components/search/instagram-search-form";

export const metadata = { title: "Busca por Instagram" };

export default async function BuscaInstagramPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const profile = await getProfile(supabase, user.id);
  if (!profile?.instagram_visible) redirect("/");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Busca por Instagram</h1>
        <p className="text-muted-foreground">
          Extrai seguidores ou seguindo de um perfil público, via Apify.
        </p>
      </div>
      <InstagramSearchForm />
    </div>
  );
}
