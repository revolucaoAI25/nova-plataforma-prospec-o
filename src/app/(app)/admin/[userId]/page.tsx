import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/credits";
import { creditosContaTeste } from "@/lib/conta-teste";
import { ContaTesteForm } from "@/components/admin/conta-teste-form";
import { PageHeader } from "@/components/layout/page-header";

export const metadata = { title: "Conta do usuário" };

export default async function AdminUserPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const me = await getProfile(supabase, user.id);
  if (!me || me.role !== "admin") redirect("/");

  const target = await getProfile(supabase, userId);
  if (!target) notFound();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader backHref="/admin" eyebrow="Administração" title="Conta do usuário" description={target.email} />
      <ContaTesteForm userId={userId} profile={target} creditosTeste={await creditosContaTeste()} />
    </div>
  );
}
