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
  // No teste grátis a página abre em modo de visualização (PortaoTesteGratis).
  if (!profile?.instagram_visible && !emTesteGratis(profile)) redirect("/");
  // No teste grátis a página é só visualização: o custo em créditos não aparece.
  const custoPorResultado = emTesteGratis(profile) ? 0 : (await custosVisiveis(supabase, ["instagram"])).instagram;

  const sugestoes = await sugestoesDaBusca(user.id, "instagram");
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Prospecção · Busca"
        title="Busca por Instagram"
        description="Extrai seguidores ou seguindo de um perfil público."
      />
      <InstagramSearchForm custoPorResultado={custoPorResultado} publicos={sugestoes.publicos} temPerfil={sugestoes.temPerfil} precisaAtualizar={sugestoes.precisaAtualizar} />
    </div>
  );
}
