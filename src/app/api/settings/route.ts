import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const poolEntrySchema = z.object({
  key: z.string(),
  nickname: z.string().optional(),
  limit: z.number(),
  usage: z.number(),
  text_search_usage: z.number().optional(),
  month: z.string(),
});

const bodySchema = z.object({
  google_maps_api_key: z.string().nullable().optional(),
  maps_pausar_ao_esgotar: z.boolean().optional(),
  maps_keys_pool: z.array(poolEntrySchema).optional(),
  apify_api_key: z.string().nullable().optional(),
  apify_keys_pool: z.array(poolEntrySchema).optional(),
});

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });

  const { data: profile } = await supabase.from("profiles").select("conta_teste").eq("id", user.id).single();

  const patch: Record<string, unknown> = {};
  if (parsed.data.google_maps_api_key !== undefined) {
    // Contas de teste nunca configuram chave própria — sempre usam o pool
    // compartilhado da plataforma (ver src/lib/maps-key.ts).
    if (profile?.conta_teste) {
      return NextResponse.json({ error: "Contas de teste não podem configurar uma chave Google Maps própria." }, { status: 403 });
    }
    patch.google_maps_api_key = parsed.data.google_maps_api_key || null;
  }
  if (parsed.data.maps_pausar_ao_esgotar !== undefined) {
    patch.maps_pausar_ao_esgotar = parsed.data.maps_pausar_ao_esgotar;
  }
  if (parsed.data.maps_keys_pool !== undefined) {
    if (profile?.conta_teste) {
      return NextResponse.json({ error: "Contas de teste usam o pool compartilhado da plataforma." }, { status: 403 });
    }
    patch.maps_keys_pool = parsed.data.maps_keys_pool;
  }
  if (parsed.data.apify_api_key !== undefined) {
    patch.apify_api_key = parsed.data.apify_api_key || null;
  }
  if (parsed.data.apify_keys_pool !== undefined) {
    if (profile?.conta_teste) {
      return NextResponse.json({ error: "Contas de teste usam a chave Apify compartilhada da plataforma." }, { status: 403 });
    }
    patch.apify_keys_pool = parsed.data.apify_keys_pool;
  }

  const { error } = await supabase.from("profiles").update(patch).eq("id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
