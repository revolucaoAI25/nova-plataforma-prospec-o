import { paginaSoAdmin } from "@/lib/admin-pagina";
import { AdminNav } from "@/components/admin/admin-nav";

/** Área de administração: uma navegação por seções para tudo que é gestão. Cada página confere o admin de novo. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await paginaSoAdmin();

  return (
    <div className="flex flex-col gap-6">
      <AdminNav />
      {children}
    </div>
  );
}
