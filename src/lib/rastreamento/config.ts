import { configPlataforma } from "@/lib/platform-settings";

/** IDs públicos do Pixel da Meta e do Clarity, cadastrados em /admin (ou no ambiente). */
export async function configRastreamento(): Promise<{ pixelId: string | null; clarityId: string | null }> {
  const [pixel, clarity] = await Promise.all([
    configPlataforma("meta_pixel_id", process.env.META_PIXEL_ID).catch(() => ""),
    configPlataforma("clarity_id", process.env.CLARITY_ID).catch(() => ""),
  ]);
  const limpo = (v: string, padrao: RegExp) => (padrao.test(v.trim()) ? v.trim() : null);
  return { pixelId: limpo(pixel, /^\d{8,20}$/), clarityId: limpo(clarity, /^[a-z0-9]{6,20}$/i) };
}
