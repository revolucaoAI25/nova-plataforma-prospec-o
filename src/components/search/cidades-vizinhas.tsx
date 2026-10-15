"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { RaioSlider } from "@/components/search/raio-slider";

interface Vizinha {
  nome: string;
  uf: string;
  distanciaKm: number;
}

const MOSTRAR = 12;

/**
 * "Incluir cidades vizinhas" da busca por CNPJ: raio de arrastar e a prévia
 * de quais municípios entram (calculada no servidor com a base do IBGE).
 */
export function CidadesVizinhas({
  municipios, ufs, km, onKmChange, idPrefixo = "vizinhas",
}: {
  municipios: string[];
  ufs: string[];
  km: number;
  onKmChange: (km: number) => void;
  idPrefixo?: string;
}) {
  const [vizinhas, setVizinhas] = useState<Vizinha[] | null>(null);
  const [naoEncontradas, setNaoEncontradas] = useState<string[]>([]);
  const [carregando, setCarregando] = useState(false);
  const semCidade = municipios.length === 0;
  const chave = `${municipios.join(",")}|${ufs.join(",")}|${km}`;

  useEffect(() => {
    if (semCidade || !km) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setCarregando(true);
      const params = new URLSearchParams({ cidades: municipios.join(","), ufs: ufs.join(","), km: String(km) });
      const resp = await fetch(`/api/localidades/vizinhas?${params}`, { signal: ctrl.signal }).catch(() => null);
      if (resp?.ok) {
        const data = (await resp.json()) as { vizinhas: Vizinha[]; naoEncontradas: string[] };
        setVizinhas(data.vizinhas);
        setNaoEncontradas(data.naoEncontradas);
      }
      setCarregando(false);
    }, 400);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
    // `chave` resume municipios/ufs/km (arrays novos a cada render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave, semCidade]);

  const ativo = !semCidade && km > 0;

  return (
    <div className="flex flex-col gap-2">
      <RaioSlider
        id={`${idPrefixo}-km`}
        label="Incluir cidades vizinhas"
        value={km}
        onChange={onKmChange}
        max={60}
        step={5}
        zero="Desligado"
        disabled={semCidade}
      />
      {semCidade ? (
        <p className="text-xs text-muted-foreground">Preencha ao menos um município para incluir as cidades em volta.</p>
      ) : ativo && (
        <div className="flex flex-col gap-1.5 text-xs">
          {carregando && !vizinhas ? (
            <span className="flex items-center gap-1.5 text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Calculando…</span>
          ) : vizinhas && vizinhas.length ? (
            <>
              <span className="text-muted-foreground">Também entram {vizinhas.length} cidade(s):</span>
              <div className="flex flex-wrap gap-1.5">
                {vizinhas.slice(0, MOSTRAR).map((v) => (
                  <span key={`${v.nome}-${v.uf}`} className="rounded-full border border-border bg-secondary/40 px-2 py-0.5">
                    {v.nome}{ufs.length !== 1 || v.uf !== ufs[0]?.toUpperCase() ? `/${v.uf}` : ""} <span className="text-muted-2">{v.distanciaKm} km</span>
                  </span>
                ))}
                {vizinhas.length > MOSTRAR && <span className="px-1 py-0.5 text-muted-foreground">+{vizinhas.length - MOSTRAR}</span>}
              </div>
            </>
          ) : vizinhas ? (
            <span className="text-muted-foreground">Nenhuma cidade a até {km} km. Aumente o raio.</span>
          ) : null}
          {naoEncontradas.length > 0 && (
            <span className="text-destructive">Não achamos {naoEncontradas.join(", ")} na lista de municípios. Confira a grafia e o estado.</span>
          )}
        </div>
      )}
    </div>
  );
}
