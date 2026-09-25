import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/credits";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

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

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar
        role={profile.role}
        email={profile.email}
        instagramVisible={profile.instagram_visible}
        linkedinVisible={profile.linkedin_visible}
        disparoHabilitado={profile.disparo_habilitado}
        enriquecimentoIaHabilitado={profile.enriquecimento_ia_habilitado}
        emailDisparoHabilitado={profile.email_disparo_habilitado}
      />
      {/* min-w-0 é essencial aqui: sem isso, um item flex nunca encolhe
          abaixo do conteúdo intrínseco — uma tabela larga (leads, usuários)
          empurra a página inteira pro lado em vez de rolar só por dentro. */}
      <div className="flex min-w-0 flex-1 flex-col transition-[padding-left] duration-200 md:pl-[var(--app-sidebar-w)]">
        <Topbar profile={profile} />
        <main className="min-w-0 flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
