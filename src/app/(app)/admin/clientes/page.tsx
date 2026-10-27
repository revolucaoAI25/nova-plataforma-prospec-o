import { createAdminClient } from "@/lib/supabase/admin";
import type { PlanRow, UserStatsRow } from "@/lib/database.types";
import { situacaoCliente, type ClienteAdmin, type FiltroSituacao } from "@/lib/admin-clientes";
import { ClientesLista, type ClienteLinha } from "@/components/admin/clientes-lista";
import { CreateUserForm } from "@/components/admin/create-user-form";
import { paginaSoAdmin } from "@/lib/admin-pagina";

export const metadata = { title: "Clientes" };

const FILTROS: FiltroSituacao[] = ["assinante", "teste", "atencao", "sem_plano", "interno"];

export default async function AdminClientesPage({ searchParams }: { searchParams: Promise<{ situacao?: string }> }) {
  await paginaSoAdmin();
  const { situacao } = await searchParams;
  const admin = createAdminClient();
  const [{ data: statsData }, { data: perfisData }, { data: planosData }] = await Promise.all([
    admin.from("user_stats").select("*").order("created_at", { ascending: false }),
    admin.from("profiles").select("*"),
    admin.from("plans").select("id, nome"),
  ]);
  const perfis = new Map(((perfisData ?? []) as (ClienteAdmin & { telefone: string | null })[]).map((p) => [p.id, p]));
  const nomesPlanos = new Map(((planosData ?? []) as Pick<PlanRow, "id" | "nome">[]).map((p) => [p.id, p.nome]));
  const agora = new Date();

  const clientes: ClienteLinha[] = ((statsData ?? []) as UserStatsRow[]).map((u) => {
    const p = perfis.get(u.id);
    const base: ClienteAdmin = p ?? {
      id: u.id, role: u.role, plano_id: null, assinatura_status: "sem_assinatura", assinatura_ciclo: "mensal",
      teste_gratis: u.teste_gratis, teste_expira_em: u.teste_expira_em, conta_teste: u.conta_teste,
    };
    return {
      id: u.id,
      email: u.email,
      nome: u.nome,
      empresa: u.empresa,
      telefone: u.telefone,
      situacao: situacaoCliente(base, base.plano_id ? nomesPlanos.get(base.plano_id) : null, agora),
      creditos: u.creditos,
      totalBuscas: u.total_searches,
      totalLeads: u.total_leads,
      ultimaBusca: u.last_search_at,
      criadoEm: u.created_at,
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <CreateUserForm />
      <ClientesLista clientes={clientes} filtroInicial={FILTROS.includes(situacao as FiltroSituacao) ? (situacao as FiltroSituacao) : "todos"} />
    </div>
  );
}
