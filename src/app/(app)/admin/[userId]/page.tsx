import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/credits";
import { AdminKeysForm } from "@/components/admin/admin-keys-form";
import { PageHeader } from "@/components/layout/page-header";

export const metadata = { title: "Chaves administradas" };

export default async function AdminUserKeysPage({ params }: { params: Promise<{ userId: string }> }) {
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
      <PageHeader
        backHref="/admin"
        eyebrow="Administração"
        title="Chaves administradas"
        description={`Chave da Casa dos Dados e pool de chaves Google Maps usadas quando ${target.email} não tem credenciais próprias configuradas.`}
      />
      <AdminKeysForm userId={userId} profile={target} />
    </div>
  );
}
