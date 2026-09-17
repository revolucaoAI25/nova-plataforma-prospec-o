import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/credits";
import { InstagramSearchForm } from "@/components/search/instagram-search-form";
import { PageHeader } from "@/components/layout/page-header";

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
      <PageHeader
        eyebrow="Prospecção · Busca"
        title="Busca por Instagram"
        description="Extrai seguidores ou seguindo de um perfil público, via Apify."
      />
      <InstagramSearchForm />
    </div>
  );
}
