"use client";

import { useMemo, useState } from "react";
import { KeyRound, Save, Eraser } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useConfirm } from "@/components/ui/confirm-provider";

export interface PlatformSettingItem {
  chave: string;
  grupo: string;
  label: string;
  secreto: boolean;
  envFallback: string;
  preenchidaNoAdmin: boolean;
  preenchidaViaEnv: boolean;
  valor: string | null;
  atualizadoEm: string | null;
}

function StatusBadge({ item }: { item: PlatformSettingItem }) {
  if (item.preenchidaNoAdmin) return <Badge variant="success">Admin</Badge>;
  if (item.preenchidaViaEnv) return <Badge variant="secondary">Railway ({item.envFallback})</Badge>;
  return <Badge variant="destructive">Não configurado</Badge>;
}

function LinhaConfig({ item, onAtualizado }: { item: PlatformSettingItem; onAtualizado: (chave: string, patch: Partial<PlatformSettingItem>) => void }) {
  const confirmar = useConfirm();
  const [valor, setValor] = useState(item.valor ?? "");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  async function salvar() {
    setSaving(true);
    const resp = await fetch("/api/admin/platform-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chave: item.chave, valor }),
    });
    setSaving(false);
    if (!resp.ok) return;
    setDirty(false);
    onAtualizado(item.chave, {
      preenchidaNoAdmin: Boolean(valor.trim()),
      valor: !item.secreto ? valor : null,
    });
    if (item.secreto) setValor("");
  }

  async function limpar() {
    if (!(await confirmar({ title: `Remover a chave cadastrada para "${item.label}"?`, description: "Volta a usar a variável de ambiente do Railway, se houver.", destructive: true }))) return;
    setValor("");
    setSaving(true);
    const resp = await fetch("/api/admin/platform-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chave: item.chave, valor: "" }),
    });
    setSaving(false);
    if (!resp.ok) return;
    setDirty(false);
    onAtualizado(item.chave, { preenchidaNoAdmin: false, valor: null });
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium text-foreground">{item.label}</span>
        <StatusBadge item={item} />
      </div>
      <div className="flex items-center gap-2">
        <Input
          type={item.secreto ? "password" : "text"}
          className="h-8 flex-1"
          placeholder={
            item.preenchidaNoAdmin && item.secreto
              ? "•••••••••••••• (preenchida — digite pra substituir)"
              : item.preenchidaViaEnv
                ? `Usando ${item.envFallback} do Railway — digite pra sobrepor`
                : "Não configurada"
          }
          value={valor}
          onChange={(e) => { setValor(e.target.value); setDirty(true); }}
        />
        <Button size="sm" variant={dirty ? "default" : "ghost"} disabled={!dirty || saving} onClick={salvar}>
          <Save className="h-3.5 w-3.5" /> {saving ? "Salvando…" : "Salvar"}
        </Button>
        {item.preenchidaNoAdmin && (
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={limpar} title="Remover chave cadastrada aqui">
            <Eraser className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Chaves de API de plataforma administráveis sem precisar mexer no
 * Railway — pedido explícito: trocar uma chave (ex: renovar a do Resend)
 * direto aqui, sem esperar redeploy. Prioridade: valor cadastrado aqui >
 * variável de ambiente do Railway (fallback, pra não quebrar quem ainda
 * não migrou). A chave OpenAI do Enriquecimento por IA fica de fora de
 * propósito — é BYOK por usuário, nunca da plataforma.
 */
export function PlatformSettingsPanel({ itensIniciais }: { itensIniciais: PlatformSettingItem[] }) {
  const [itens, setItens] = useState(itensIniciais);

  function atualizarItem(chave: string, patch: Partial<PlatformSettingItem>) {
    setItens((prev) => prev.map((it) => (it.chave === chave ? { ...it, ...patch } : it)));
  }

  const grupos = useMemo(() => {
    const mapa = new Map<string, PlatformSettingItem[]>();
    for (const item of itens) {
      if (!mapa.has(item.grupo)) mapa.set(item.grupo, []);
      mapa.get(item.grupo)!.push(item);
    }
    return Array.from(mapa.entries());
  }, [itens]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="h-4 w-4 text-primary" /> Chaves de API de plataforma
        </CardTitle>
        <CardDescription>
          Usadas por toda a plataforma (não por usuário individual). Uma chave cadastrada aqui tem prioridade sobre a variável de ambiente
          equivalente no Railway — deixar em branco volta a usar a do Railway, se existir. A chave OpenAI do Enriquecimento por IA não entra
          aqui: cada usuário cadastra a própria em Configurações.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {grupos.map(([grupo, itensDoGrupo]) => (
          <div key={grupo} className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{grupo}</h3>
            <div className="flex flex-col gap-2">
              {itensDoGrupo.map((item) => (
                <LinhaConfig key={item.chave} item={item} onAtualizado={atualizarItem} />
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
