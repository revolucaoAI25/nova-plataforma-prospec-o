"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { Map as MapaMaplibre, GeoJSONSource, MapLayerMouseEvent } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Flame, Loader2, MapPin, MapPinned } from "lucide-react";
import { cn } from "@/lib/utils";

interface PontoMapa {
  id: string;
  nome: string | null;
  telefone: string | null;
  endereco: string | null;
  bairro: string | null;
  municipio: string | null;
  uf: string | null;
  avaliacao: number | null;
  totalAvaliacoes: number | null;
  site: string | null;
  lat: number | null;
  lng: number | null;
  precisao: string | null;
}

type Modo = "calor" | "pontos";

// Mapas abertos do OpenFreeMap (OpenStreetMap), sem chave nem limite de uso.
const ESTILO = {
  light: "https://tiles.openfreemap.org/styles/positron",
  dark: "https://tiles.openfreemap.org/styles/dark",
};

function assinarTema(aoMudar: () => void) {
  const obs = new MutationObserver(aoMudar);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  const mq = window.matchMedia("(prefers-color-scheme: light)");
  mq.addEventListener("change", aoMudar);
  return () => {
    obs.disconnect();
    mq.removeEventListener("change", aoMudar);
  };
}
function temaAtual(): "light" | "dark" {
  const t = document.documentElement.getAttribute("data-theme");
  if (t === "light" || t === "dark") return t;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

const temCoordenada = (p: PontoMapa) => typeof p.lat === "number" && typeof p.lng === "number";

function geojson(pontos: PontoMapa[]) {
  return {
    type: "FeatureCollection" as const,
    features: pontos.filter(temCoordenada).map((p) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [p.lng as number, p.lat as number] },
      // Centro da cidade pesa menos: é só "está nesta cidade".
      properties: { id: p.id, peso: p.precisao === "cidade" ? 0.35 : 1 },
    })),
  };
}

/** Onde estão: por bairro quando quase tudo é de uma cidade só, senão por cidade. */
function ranking(pontos: PontoMapa[]): { titulo: string; itens: { nome: string; qtd: number }[] } {
  const porCidade = new Map<string, number>();
  for (const p of pontos) if (p.municipio) porCidade.set(p.municipio, (porCidade.get(p.municipio) ?? 0) + 1);
  const cidades = [...porCidade.entries()].sort((a, b) => b[1] - a[1]);
  const umaCidade = cidades.length > 0 && cidades[0][1] / Math.max(1, pontos.length) >= 0.75;
  if (umaCidade) {
    const porBairro = new Map<string, number>();
    for (const p of pontos) if (p.bairro) porBairro.set(p.bairro, (porBairro.get(p.bairro) ?? 0) + 1);
    if (porBairro.size >= 3) {
      return {
        titulo: `Bairros de ${cidades[0][0]}`,
        itens: [...porBairro.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([nome, qtd]) => ({ nome, qtd })),
      };
    }
  }
  return { titulo: "Cidades", itens: cidades.slice(0, 8).map(([nome, qtd]) => ({ nome, qtd })) };
}

function conteudoPopup(p: PontoMapa): HTMLElement {
  // Montado com nós de texto: nome e endereço vêm de fontes externas.
  const raiz = document.createElement("div");
  raiz.className = "mapa-popup";
  const linha = (texto: string, classe: string) => {
    const el = document.createElement("p");
    el.className = classe;
    el.textContent = texto;
    raiz.appendChild(el);
  };
  linha(p.nome || "Sem nome", "mapa-popup-nome");
  if (p.telefone) linha(p.telefone, "mapa-popup-linha");
  const local = [p.endereco, p.municipio].filter(Boolean).join(" · ");
  if (local) linha(local, "mapa-popup-linha mapa-popup-suave");
  if (p.avaliacao) linha(`★ ${p.avaliacao}${p.totalAvaliacoes ? ` (${p.totalAvaliacoes} avaliações)` : ""}`, "mapa-popup-linha");
  if (p.precisao === "cidade") linha("Posição aproximada: centro da cidade", "mapa-popup-linha mapa-popup-suave");
  return raiz;
}

export function MapaResultados({ searchId, className }: { searchId: string; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapaRef = useRef<MapaMaplibre | null>(null);
  const pontosRef = useRef<PontoMapa[]>([]);
  const enquadradoRef = useRef(false);
  const [pontos, setPontos] = useState<PontoMapa[]>([]);
  const [pendentes, setPendentes] = useState(0);
  const [carregado, setCarregado] = useState(false);
  const [localizando, setLocalizando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [modo, setModo] = useState<Modo>("calor");
  const [mapaPronto, setMapaPronto] = useState(false);
  const tema = useSyncExternalStore(assinarTema, temaAtual, () => "dark" as const);

  const total = pontos.length;
  const noMapa = useMemo(() => pontos.filter(temCoordenada), [pontos]);
  const aproximados = noMapa.filter((p) => p.precisao === "cidade").length;
  const regioes = useMemo(() => ranking(pontos), [pontos]);

  // ── Dados: carrega e vai localizando o que falta, em lotes ──────────
  useEffect(() => {
    let ativo = true;
    (async () => {
      const resp = await fetch(`/api/historico/${searchId}/mapa`, { cache: "no-store" }).catch(() => null);
      const data = resp?.ok ? await resp.json() : null;
      if (!ativo) return;
      if (!data) {
        setErro("Não foi possível carregar o mapa.");
        setCarregado(true);
        return;
      }
      pontosRef.current = data.pontos;
      setPontos(data.pontos);
      setPendentes(data.pendentes);
      setCarregado(true);

      let restantes: number = data.pendentes;
      if (restantes > 0) setLocalizando(true);
      while (ativo && restantes > 0) {
        const r = await fetch(`/api/historico/${searchId}/mapa`, { method: "POST" }).catch(() => null);
        const lote = r?.ok ? await r.json() : null;
        if (!ativo) return;
        if (!lote || !lote.pontos.length) break;
        const porId = new Map<string, PontoMapa>(lote.pontos.map((p: PontoMapa) => [p.id, p]));
        pontosRef.current = pontosRef.current.map((p) => porId.get(p.id) ?? p);
        setPontos(pontosRef.current);
        restantes = lote.pendentes;
        setPendentes(restantes);
      }
      if (ativo) setLocalizando(false);
    })();
    return () => {
      ativo = false;
    };
  }, [searchId]);

  // ── Mapa ─────────────────────────────────────────────────────────────
  const adicionarCamadas = useCallback((mapa: MapaMaplibre) => {
    if (mapa.getSource("leads")) return;
    mapa.addSource("leads", { type: "geojson", data: geojson(pontosRef.current) });
    mapa.addLayer({
      id: "leads-calor",
      type: "heatmap",
      source: "leads",
      maxzoom: 16,
      paint: {
        "heatmap-weight": ["get", "peso"],
        "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 8, 0.25, 12, 0.6, 15, 1.2],
        "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 8, 10, 12, 20, 15, 32],
        "heatmap-opacity": ["interpolate", ["linear"], ["zoom"], 13, 0.8, 16, 0.3],
        "heatmap-color": [
          "interpolate", ["linear"], ["heatmap-density"],
          0, "rgba(0,200,83,0)",
          0.1, "rgba(0,200,83,0.25)",
          0.3, "rgba(0,200,83,0.75)",
          0.5, "#7fe05a",
          0.7, "#f5d33a",
          0.85, "#f5a623",
          1, "#ff5c5c",
        ],
      },
    });
    mapa.addLayer({
      id: "leads-pontos",
      type: "circle",
      source: "leads",
      layout: { visibility: "none" },
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 3, 13, 6, 16, 9],
        "circle-color": "#00c853",
        "circle-opacity": ["case", ["<", ["get", "peso"], 1], 0.45, 0.9],
        "circle-stroke-width": 1.5,
        "circle-stroke-color": "#ffffff",
      },
    });
  }, []);

  useEffect(() => {
    if (!containerRef.current || mapaRef.current) return;
    let cancelado = false;
    let mapaCriado: MapaMaplibre | null = null;
    (async () => {
      const maplibre = (await import("maplibre-gl")).default;
      if (cancelado || !containerRef.current) return;
      const mapa = new maplibre.Map({
        container: containerRef.current,
        style: ESTILO[temaAtual()],
        center: [-46.63, -23.55],
        zoom: 9,
        attributionControl: { compact: true },
        cooperativeGestures: true,
      });
      mapaCriado = mapa;
      mapaRef.current = mapa;
      mapa.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");
      // Atribuição começa recolhida (só o "i"), sem cobrir o mapa.
      mapa.once("load", () => containerRef.current?.querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show"));
      mapa.on("style.load", () => {
        adicionarCamadas(mapa);
        setMapaPronto(true);
      });

      const popup = new maplibre.Popup({ closeButton: false, maxWidth: "280px", offset: 10 });
      mapa.on("click", "leads-pontos", (e: MapLayerMouseEvent) => {
        const id = e.features?.[0]?.properties?.id as string | undefined;
        const p = pontosRef.current.find((x) => x.id === id);
        if (!p || !temCoordenada(p)) return;
        popup.setLngLat([p.lng as number, p.lat as number]).setDOMContent(conteudoPopup(p)).addTo(mapa);
      });
      mapa.on("mouseenter", "leads-pontos", () => { mapa.getCanvas().style.cursor = "pointer"; });
      mapa.on("mouseleave", "leads-pontos", () => { mapa.getCanvas().style.cursor = ""; });
    })();
    return () => {
      cancelado = true;
      mapaCriado?.remove();
      mapaRef.current = null;
    };
  }, [adicionarCamadas]);

  // Tema mudou: troca o estilo base (as camadas voltam no style.load).
  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa || !mapaPronto) return;
    mapa.setStyle(ESTILO[tema]);
  }, [tema, mapaPronto]);

  // Dados novos → atualiza a fonte e enquadra uma vez quando já tem pontos.
  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa || !mapaPronto) return;
    (mapa.getSource("leads") as GeoJSONSource | undefined)?.setData(geojson(pontos));
    if (!enquadradoRef.current && noMapa.length) {
      const lats = noMapa.map((p) => p.lat as number);
      const lngs = noMapa.map((p) => p.lng as number);
      mapa.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: 48, maxZoom: 14, duration: 0 });
      // Enquadra de novo quando a localização termina (os primeiros pontos podem ser poucos).
      if (!localizando) enquadradoRef.current = true;
    }
  }, [pontos, noMapa, mapaPronto, localizando]);

  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa || !mapaPronto || !mapa.getLayer("leads-pontos")) return;
    // Pontos sempre aparecem de perto; o calor some no modo "Pontos".
    mapa.setLayoutProperty("leads-calor", "visibility", modo === "calor" ? "visible" : "none");
    mapa.setLayoutProperty("leads-pontos", "visibility", modo === "pontos" ? "visible" : "none");
  }, [modo, mapaPronto, tema]);

  const maxRegiao = regioes.itens[0]?.qtd ?? 1;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-primary"><MapPinned className="h-4 w-4" /></span>
          <div>
            <p className="text-sm font-semibold text-foreground">Mapa dos resultados</p>
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {!carregado
                ? "Carregando…"
                : localizando
                  ? `Localizando endereços… ${total - pendentes} de ${total}`
                  : `${noMapa.length} de ${total} empresas no mapa`}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-secondary/40 p-1" role="radiogroup" aria-label="Visualização">
          {([["calor", "Calor", Flame], ["pontos", "Pontos", MapPin]] as const).map(([m, rotulo, Icone]) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={modo === m}
              onClick={() => setModo(m)}
              className={cn(
                "flex cursor-pointer items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium",
                modo === m ? "bg-card text-foreground shadow-[var(--elevation-sm)]" : "text-muted-foreground",
              )}
            >
              <Icone className="h-3.5 w-3.5" /> {rotulo}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_260px]">
        <div className="relative h-[420px] overflow-hidden rounded-xl border border-border bg-secondary/30 sm:h-[480px]">
          <div ref={containerRef} className="h-full w-full" />
          {(localizando || !carregado) && (
            <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2 rounded-full border border-border bg-card/95 px-3 py-1.5 text-xs text-foreground shadow-[var(--elevation-md)]">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              {carregado ? "O mapa vai se preenchendo" : "Carregando mapa"}
            </div>
          )}
          {erro && <p className="absolute inset-x-3 top-3 rounded-lg bg-card p-3 text-xs text-destructive">{erro}</p>}
        </div>

        <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-2">Onde estão · {regioes.titulo}</p>
          {regioes.itens.length ? (
            <ul className="flex flex-col gap-2.5">
              {regioes.itens.map((r) => (
                <li key={r.nome} className="flex flex-col gap-1">
                  <div className="flex items-baseline justify-between gap-2 text-xs">
                    <span className="truncate font-medium text-foreground">{r.nome}</span>
                    <span className="tabular-nums text-muted-foreground">{r.qtd}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(6, (r.qtd / maxRegiao) * 100)}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">{carregado ? "Sem cidade informada nestes leads." : "…"}</p>
          )}
          {aproximados > 0 && !localizando && (
            <p className="mt-auto text-[11px] leading-snug text-muted-foreground">
              {aproximados} endereço{aproximados > 1 ? "s" : ""} sem rua localizável aparece{aproximados > 1 ? "m" : ""} no centro da cidade, com peso menor.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
