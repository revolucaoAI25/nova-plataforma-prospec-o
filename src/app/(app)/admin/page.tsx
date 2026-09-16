import { redirect } from "next/navigation";
import Link from "next/link";
import { Send } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/credits";
import type { UserStatsRow } from "@/lib/database.types";
import { AdminUsersTable } from "@/components/admin/admin-users-table";
import { CreateUserForm } from "@/components/admin/create-user-form";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Administração" };

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getProfile(supabase, user.id);
  if (!profile || profile.role !== "admin") redirect("/");

  const { data } = await supabase.from("user_stats").select("*").order("created_at", { ascending: false });
  const users = (data as UserStatsRow[]) ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Administração</h1>
          <p className="text-muted-foreground">Usuários, créditos e chaves administradas.</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/disparo">
            <Send className="h-4 w-4" /> Canal oficial — disparo
          </Link>
        </Button>
      </div>
      <CreateUserForm />
      <AdminUsersTable users={users} currentUserId={user.id} />
    </div>
  );
}
