import { z } from "zod";
import { localizarEndereco } from "@/lib/geocodificacao";

/**
 * Busca do Google Maps por raio a partir de um endereço (avulsa e no
 * fluxo). O formulário já confere o endereço e manda o ponto; sem ponto
 * (ou fora do Brasil), o servidor localiza de novo.
 */
export const RAIO_MAPS_MAX_KM = 50;

export const raioMapsSchema = z.object({
  endereco: z.string().trim().min(3).max(200),
  km: z.number().min(1).max(RAIO_MAPS_MAX_KM),
  lat: z.number().optional(),
  lng: z.number().optional(),
  cidade: z.string().optional(),
  uf: z.string().optional(),
});

export type RaioMapsEntrada = z.infer<typeof raioMapsSchema>;

const noBrasil = (lat?: number, lng?: number) =>
  typeof lat === "number" && typeof lng === "number" && lat > -34 && lat < 6 && lng > -74.5 && lng < -28;

export async function resolverRaioMaps(r: RaioMapsEntrada) {
  let { lat, lng, cidade = "", uf = "" } = r;
  if (!noBrasil(lat, lng)) {
    const ponto = await localizarEndereco(r.endereco);
    if (!ponto) return null;
    ({ lat, lng, cidade, uf } = ponto);
  }
  return { lat: lat!, lng: lng!, km: r.km, cidade, uf, descricao: `${r.km} km de ${r.endereco}` };
}
