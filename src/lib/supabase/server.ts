import "@/lib/supabase/websocket-polyfill";
import { cache } from "react";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/database.types";

/**
 * Uma página do app chama getUser no layout e de novo na própria página
 * (e às vezes em componentes) — cada chamada é uma ida ao servidor de
 * autenticação. `cache` do React guarda o resultado durante a renderização
 * de UMA requisição (fora de Server Components não guarda nada, então rotas
 * de API e o login seguem conferindo a cada chamada).
 */
const usuarioDaRequisicao = cache(async () => (await criarCliente()).auth.getUser());

/**
 * Cliente Supabase para Server Components, Server Actions e Route Handlers —
 * respeita RLS com a sessão do usuário logado (via cookies).
 */
export async function createClient() {
  const client = await criarCliente();
  const getUserOriginal = client.auth.getUser.bind(client.auth);
  client.auth.getUser = ((jwt?: string) => (jwt ? getUserOriginal(jwt) : usuarioDaRequisicao())) as typeof client.auth.getUser;
  return client;
}

async function criarCliente() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // chamado de um Server Component sem permissão de escrita —
            // o proxy.ts já cuida de renovar a sessão nesse caso.
          }
        },
      },
    },
  );
}
