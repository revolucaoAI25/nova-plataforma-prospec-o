"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RaioSlider } from "@/components/search/raio-slider";

export interface PontoRaio {
  lat: number;
  lng: number;
  cidade: string;
  uf: string;
  rotulo: string;
}

/**
 * Busca do Google Maps por raio: endereço de referência + km de arrastar.
 * Ao sair do campo, o endereço é conferido no servidor e aparece como foi
 * entendido — a pessoa vê o centro antes de gastar créditos.
 */
export function RaioEndereco({
  endereco, km, ponto, onChange, idPrefixo = "raio",
}: {
  endereco: string;
  km: number;
  ponto: PontoRaio | null;
  onChange: (v: { endereco: string; km: number; ponto: PontoRaio | null }) => void;
  idPrefixo?: string;
}) {
  const [conferindo, setConferindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [conferido, setConferido] = useState(ponto ? endereco : "");

  async function conferir() {
    const q = endereco.trim();
    if (q.length < 3 || q === conferido) return;
    setConferindo(true);
    setErro(null);
    const resp = await fetch(`/api/localidades/endereco?q=${encodeURIComponent(q)}`).catch(() => null);
    const data = resp ? await resp.json().catch(() => null) : null;
    setConferindo(false);
    setConferido(q);
    if (!resp?.ok || !data) {
      setErro(data?.error || "Não deu para conferir o endereço agora.");
      onChange({ endereco, km, ponto: null });
      return;
    }
    onChange({ endereco, km, ponto: data as PontoRaio });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${idPrefixo}-endereco`}>Endereço de referência</Label>
        <Input
          id={`${idPrefixo}-endereco`}
          value={endereco}
          onChange={(e) => {
            setErro(null);
            onChange({ endereco: e.target.value, km, ponto: e.target.value.trim() === conferido ? ponto : null });
          }}
          onBlur={conferir}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void conferir();
            }
          }}
          placeholder="Ex: Av. Industrial, Santo André"
        />
        {conferindo ? (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Conferindo o endereço…</p>
        ) : ponto ? (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary" /> Centro da busca: <span className="text-foreground">{ponto.rotulo}</span>
          </p>
        ) : erro ? (
          <p className="text-xs text-destructive">{erro}</p>
        ) : (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" /> Rua, bairro ou ponto conhecido, com a cidade junto.
          </p>
        )}
      </div>
      <RaioSlider id={`${idPrefixo}-km`} label="Raio da busca" value={km} onChange={(v) => onChange({ endereco, km: v, ponto })} min={1} max={50} />
    </div>
  );
}
