import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/credits";
import { LinkedInSearchForm } from "@/components/search/linkedin-search-form";
import { PageHeader } from "@/components/layout/page-header";

export const metadata = { title: "Busca por LinkedIn" };

export default async function BuscaLinkedInPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const profile = await getProfile(supabase, user.id);
  if (!profile?.linkedin_visible) redirect("/");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Prospecção · Busca"
        title="Busca por LinkedIn"
        description="Encontra pessoas e decisores por cargo e localização, via Apify."
      />
      <LinkedInSearchForm />
    </div>
  );
}
