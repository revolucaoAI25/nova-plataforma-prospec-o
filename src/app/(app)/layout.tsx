import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/credits";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { GuiaFlutuante } from "@/components/onboarding/guia-flutuante";
import { PortaoTesteGratis } from "@/components/layout/portao-teste-gratis";
import { emTesteGratis } from "@/lib/teste-gratis-regras";
import { situacaoTeste } from "@/lib/teste-gratis";
import { TourPlataforma, type PublicoTour } from "@/components/onboarding/tour-plataforma";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const profile = await getProfile(supabase, user.id);
  if (!profile) {
    // Sessão válida mas sem linha em `profiles` (ex: usuário criado em
    // auth.users antes de rodar as migrations, ou RLS bloqueando a leitura).
    // Sem o signOut aqui, isso vira um loop infinito: o proxy manda de volta
    // pra "/" por ver sessão válida, e aqui manda de novo pra "/login".
    await supabase.auth.signOut();
    redirect("/login?perfil_ausente=1");
  }

  // Contas de teste: checado a cada navegação, não só no login — bloqueia
  // em tempo real mesmo se o usuário já estava com a aba aberta quando o
  // prazo bateu (ver seção 5.2 do plano de reconstrução).
  if (profile.conta_teste && profile.teste_expira_em && new Date(profile.teste_expira_em) <= new Date()) {
    await supabase.auth.signOut();
    redirect("/login?expirado=1");
  }

  const testeGratis = emTesteGratis(profile);
  // Teste grátis: prazo e o preço de entrada que aparecem nas ofertas.
  const [teste, precoMinimo] = testeGratis
    ? await Promise.all([
        situacaoTeste(profile),
        supabase
          .from("plans")
          .select("preco_centavos")
          .eq("ativo", true)
          .order("preco_centavos")
          .limit(1)
          .then(({ data }) => (data?.[0] ? (data[0] as { preco_centavos: number }).preco_centavos / 100 : null)),
      ])
    : [null, null];

  // Tour guiado: um para o teste grátis (conhecer e assinar), outro para quem
  // já é cliente (começar pela estratégia). Quem ainda não pagou a assinatura
  // vê a fatura antes, não o tour.
  const publicoTour: PublicoTour | null = testeGratis ? "teste" : profile.assinatura_status === "pendente" ? null : "assinante";

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar
        role={profile.role}
        email={profile.email}
        instagramVisible={profile.instagram_visible}
        linkedinVisible={profile.linkedin_visible}
        disparoHabilitado={profile.disparo_habilitado}
        enriquecimentoIaHabilitado={profile.enriquecimento_ia_habilitado}
        bigdatacorpEnrichmentHabilitado={profile.bigdatacorp_enrichment_habilitado}
        emailDisparoHabilitado={profile.email_disparo_habilitado}
        linkedinDisparoHabilitado={profile.linkedin_disparo_habilitado}
        testeGratis={testeGratis}
      />
      {/* min-w-0 é essencial aqui: sem isso, um item flex nunca encolhe
          abaixo do conteúdo intrínseco — uma tabela larga (leads, usuários)
          empurra a página inteira pro lado em vez de rolar só por dentro. */}
      <div className="flex min-w-0 flex-1 flex-col transition-[padding-left] duration-200 md:pl-[var(--app-sidebar-w)]">
        <Topbar profile={profile} diasRestantesTeste={teste?.diasRestantes ?? null} />
        <main className="min-w-0 flex-1 p-4 pb-[max(1rem,var(--guia-espaco,0px))] md:p-8 md:pb-[max(2rem,var(--guia-espaco,0px))]">
          {testeGratis && teste ? (
            <PortaoTesteGratis creditos={profile.creditos} teste={teste} precoMinimo={precoMinimo}>{children}</PortaoTesteGratis>
          ) : (
            children
          )}
        </main>
      </div>
      {/* O guia leva à estratégia por IA, que fica bloqueada no teste grátis. */}
      {!testeGratis && <GuiaFlutuante />}
      {publicoTour && (
        <TourPlataforma
          publico={publicoTour}
          userId={profile.id}
          visto={Boolean(profile.tour_visto?.[publicoTour])}
          nome={(profile.nome ?? "").trim().split(/\s+/)[0] || null}
          creditos={profile.creditos}
          diasTeste={teste?.dias || null}
          precoMinimo={precoMinimo}
        />
      )}
    </div>
  );
}
