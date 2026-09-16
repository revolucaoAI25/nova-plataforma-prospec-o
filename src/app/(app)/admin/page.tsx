import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/credits";
import type { UserStatsRow } from "@/lib/database.types";
import { AdminUsersTable } from "@/components/admin/admin-users-table";
import { CreateUserForm } from "@/components/admin/create-user-form";

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
      <div>
        <h1 className="text-2xl font-semibold">Administração</h1>
        <p className="text-muted-foreground">Usuários, créditos e chaves administradas.</p>
      </div>
      <CreateUserForm />
      <AdminUsersTable users={users} currentUserId={user.id} />
    </div>
  );
}
