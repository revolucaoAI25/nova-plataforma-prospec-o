import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { acaoViaGet, apiBloqueadaNoTeste, emTesteGratis, MSG_TESTE_GRATIS } from "@/lib/teste-gratis-regras";
import { apiConfereAcesso, COLUNAS_ACESSO, motivoBloqueio, MSG_ACESSO_BLOQUEADO, type PerfilAcesso } from "@/lib/acesso-regras";

// Não importa o polyfill de WebSocket (src/lib/supabase/websocket-polyfill)
// aqui: este arquivo roda no Edge Runtime (proxy.ts, sem `runtime` explícito
// = Edge no Next.js), que já tem WebSocket nativo e NÃO suporta os módulos
// Node (net/tls) que o pacote `ws` usa — importá-lo aqui quebraria o build.

// Além das páginas de login, da página de vendas (/conheca), da contratação
// (/assinar) e do teste grátis (/teste-gratis), com as APIs que criam a conta: rotas de API
// chamadas por quem NÃO tem sessão — o link de descadastro no rodapé dos
// e-mails (destinatário do disparo) e os webhooks do LinkedIn. Sem isso o proxy devolvia 307 pro /login e nada
// disso funcionava. Cada rota faz a própria verificação (token/segredo).
// Os webhooks em /api/webhooks já ficam fora do matcher do proxy.
const PUBLIC_PATHS = [
  "/conheca",
  "/privacidade",
  "/termos",
  "/assinar",
  "/api/assinar",
  "/teste-gratis",
  "/api/teste-gratis",
  "/api/lp",
  "/api/retomada/sair",
  "/login",
  "/redefinir-senha",
  "/api/senha",
  "/auth",
  "/api/email-dispatch/unsubscribe",
  "/api/linkedin-dispatch/webhooks",
];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Renova a sessão Supabase a cada request e redireciona pra /login quando
 * necessário. Chamado pelo proxy.ts (equivalente ao antigo middleware.ts —
 * renomeado no Next.js 16, ver AGENTS.md).
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getClaims (e não getUser): com as chaves assimétricas do Supabase o
  // token é conferido aqui mesmo, sem uma ida ao servidor de autenticação a
  // cada request; renova a sessão quando está para vencer igual ao getUser.
  // Com o segredo simétrico antigo, cai sozinho na consulta ao servidor.
  // Páginas e APIs continuam chamando getUser (conferência completa).
  // Se a conferência local falhar (chaves indisponíveis), não desloga
  // ninguém: confere no servidor como antes.
  const { data: sessao, error: erroClaims } = await supabase.auth.getClaims();
  let user: { id: string } | null = sessao?.claims?.sub ? { id: sessao.claims.sub } : null;
  if (!user && erroClaims) {
    const { data } = await supabase.auth.getUser();
    user = data.user ? { id: data.user.id } : null;
  }

  const { pathname } = request.nextUrl;

  // A raiz do domínio, para quem não está logado, é a página de vendas.
  // Rewrite (não redirect): o anúncio que aponta para a raiz abre a página
  // direto, sem uma ida e volta a mais ao servidor (conta no connect rate),
  // e os parâmetros da URL (utm_*, fbclid) continuam na barra de endereço.
  if (!user && pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/conheca";
    return NextResponse.rewrite(url);
  }

  if (!user && !isPublicPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Chamadas que criam, alteram ou enviam algo conferem o acesso: quem não
  // pagou, cancelou (depois do período pago) ou está com o pagamento
  // recusado não usa a plataforma; no teste grátis, os recursos pagos sem
  // flag própria no perfil (fluxos, funil, estratégia por IA, conexões)
  // ficam fechados. Leituras (GET) não pagam a consulta extra ao perfil.
  const bloqueadaNoTeste = apiBloqueadaNoTeste(pathname, request.method);
  if (user && (bloqueadaNoTeste || apiConfereAcesso(pathname, request.method, acaoViaGet(pathname)))) {
    const consulta = await supabase.from("profiles").select(COLUNAS_ACESSO).eq("id", user.id).maybeSingle();
    // Sem a migration 0047 (coluna acesso_ate), vale só a regra do teste grátis.
    const semMigration = Boolean(consulta.error);
    const { data } = semMigration
      ? await supabase.from("profiles").select("role, teste_gratis, assinatura_status").eq("id", user.id).maybeSingle()
      : consulta;
    const perfil = data as unknown as PerfilAcesso | null;
    if (bloqueadaNoTeste && emTesteGratis(perfil)) {
      return NextResponse.json({ error: MSG_TESTE_GRATIS, testeGratis: true }, { status: 403 });
    }
    const motivo = semMigration ? null : motivoBloqueio(perfil);
    if (motivo) {
      return NextResponse.json({ error: MSG_ACESSO_BLOQUEADO[motivo], acessoBloqueado: motivo }, { status: 403 });
    }
  }

  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.searchParams.delete("next");
    return NextResponse.redirect(url);
  }

  return response;
}
