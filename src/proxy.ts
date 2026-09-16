import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy-session";

// "proxy" é o novo nome do antigo "middleware" a partir do Next.js 16 —
// mesmo arquivo/comportamento, só a convenção mudou (ver AGENTS.md).
export function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/webhooks|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
