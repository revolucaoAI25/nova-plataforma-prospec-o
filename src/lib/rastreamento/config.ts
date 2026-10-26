import { configPlataforma } from "@/lib/platform-settings";

/** Pixel do Leadmatic: vale enquanto nenhum outro for cadastrado em /admin (o ID é público, aparece no código da página). */
export const PIXEL_PADRAO = "1419264626490385";

/** ID público do Pixel da Meta, cadastrado em /admin (ou no ambiente). */
export async function configRastreamento(): Promise<{ pixelId: string | null }> {
  const pixel = await configPlataforma("meta_pixel_id", process.env.META_PIXEL_ID || PIXEL_PADRAO).catch(() => PIXEL_PADRAO);
  return { pixelId: /^\d{8,20}$/.test(pixel.trim()) ? pixel.trim() : null };
}
