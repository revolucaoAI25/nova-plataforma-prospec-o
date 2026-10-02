import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile, custosVisiveis } from "@/lib/credits";
import { InstagramSearchForm } from "@/components/search/instagram-search-form";
import { PageHeader } from "@/components/layout/page-header";
import { sugestoesDaBusca } from "@/lib/onboarding/publicos";
import { emTesteGratis } from "@/lib/teste-gratis-regras";

export const metadata = { title: "Busca por Instagram" };

export default async function BuscaInstagramPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const profile = await getProfile(supabase, user.id);
  // No teste grátis a página aparece com o convite para assinar (PortaoTesteGratis).
  if (!profile?.instagram_visible && !emTesteGratis(profile)) redirect("/");
  const custos = await custosVisiveis(supabase, ["instagram"]);

  const sugestoes = await sugestoesDaBusca(user.id, "instagram");
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Prospecção · Busca"
        title="Busca por Instagram"
        description="Extrai seguidores ou seguindo de um perfil público."
      />
      <InstagramSearchForm custoPorResultado={custos.instagram} publicos={sugestoes.publicos} temPerfil={sugestoes.temPerfil} precisaAtualizar={sugestoes.precisaAtualizar} />
    </div>
  );
}
