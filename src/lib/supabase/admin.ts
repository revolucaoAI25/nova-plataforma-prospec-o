import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * Cliente com service role — ignora RLS. Uso exclusivo em rotas de
 * servidor que precisam agir fora do escopo do usuário logado (admin,
 * débito de créditos que sobrevive a race conditions, criação de contas).
 * NUNCA importar em código que roda no navegador.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
