import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/credits";
import { Button } from "@/components/ui/button";
import { AdminKeysForm } from "@/components/admin/admin-keys-form";

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
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
          <Link href="/admin">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold">Chaves administradas — {target.email}</h1>
        <p className="text-muted-foreground">
          Chave da Casa dos Dados e pool de chaves Google Maps usadas quando este usuário não tem
          credenciais próprias configuradas.
        </p>
      </div>
      <AdminKeysForm userId={userId} profile={target} />
    </div>
  );
}
