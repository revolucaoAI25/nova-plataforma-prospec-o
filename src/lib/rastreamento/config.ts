import { configPlataforma } from "@/lib/platform-settings";

/** Pixel do Leadmatic: vale enquanto nenhum outro for cadastrado em /admin (o ID é público, aparece no código da página). */
export const PIXEL_PADRAO = "1419264626490385";

/** IDs públicos do Pixel da Meta e do Clarity, cadastrados em /admin (ou no ambiente). */
export async function configRastreamento(): Promise<{ pixelId: string | null; clarityId: string | null }> {
  const [pixel, clarity] = await Promise.all([
    configPlataforma("meta_pixel_id", process.env.META_PIXEL_ID || PIXEL_PADRAO).catch(() => PIXEL_PADRAO),
    configPlataforma("clarity_id", process.env.CLARITY_ID).catch(() => ""),
  ]);
  const limpo = (v: string, padrao: RegExp) => (padrao.test(v.trim()) ? v.trim() : null);
  return { pixelId: limpo(pixel, /^\d{8,20}$/), clarityId: limpo(clarity, /^[a-z0-9]{6,20}$/i) };
}
