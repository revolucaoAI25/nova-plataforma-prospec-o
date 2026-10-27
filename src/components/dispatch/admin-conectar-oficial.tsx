"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, Copy, ExternalLink, Link2, Loader2, RefreshCw, Search, X } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

const ORIGEM_DATAFY = "https://app.datafyapi.com.br";

export interface ClienteOpcao {
  id: string;
  email: string;
  nome: string | null;
  empresa: string | null;
}

type Modo = "gerar" | "vincular";

/**
 * Admin conecta o WhatsApp oficial de um cliente: gera a conexão (abre a
 * janela da Meta agora, em chamada com o cliente, ou copia o link para ele
 * abrir — vale 24 h) ou vincula um canal que já existe na Datafy pelo token.
 */
export function AdminConectarOficial({ clientes, parceiroConfigurado }: { clientes: ClienteOpcao[]; parceiroConfigurado: boolean }) {
  const [busca, setBusca] = useState("");
  const [cliente, setCliente] = useState<ClienteOpcao | null>(null);
  const [modo, setModo] = useState<Modo>(parceiroConfigurado ? "gerar" : "vincular");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [conexao, setConexao] = useState<{ url: string; instanceId: string } | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [nome, setNome] = useState("WhatsApp oficial");
  const [token, setToken] = useState("");
  const [numero, setNumero] = useState("");

  const termo = busca.trim().toLowerCase();
  const resultados = useMemo(
    () =>
      termo.length < 2
        ? []
        : clientes.filter((c) => [c.email, c.nome, c.empresa].join(" ").toLowerCase().includes(termo)).slice(0, 8),
    [clientes, termo],
  );

  function limpar() {
    setErro(null);
    setSucesso(null);
    setConexao(null);
    setCopiado(false);
  }

  const verificar = useCallback(async () => {
    if (!cliente || !conexao) return;
    setCarregando(true);
    setErro(null);
    const resp = await fetch("/api/admin/oficial/confirmar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: cliente.id, instanceId: conexao.instanceId }),
    }).catch(() => null);
    const json = await resp?.json().catch(() => null);
    setCarregando(false);
    if (!resp?.ok) return setErro(json?.error ?? "Não foi possível verificar.");
    if (json.conectado) {
      setSucesso(`Conectado${json.numero ? ` (+${json.numero})` : ""}. O número já aparece em Disparo WhatsApp → Números, na conta do cliente.`);
      setConexao(null);
    } else {
      setErro("Ainda não conectado. Quando o cliente concluir, o canal é ativado sozinho em até 10 minutos, ou clique de novo aqui.");
    }
  }, [cliente, conexao]);

  // Janela aberta por aqui: a Datafy avisa quando o número conecta.
  useEffect(() => {
    const aoReceber = (e: MessageEvent) => {
      if (e.origin !== ORIGEM_DATAFY || e.data?.source !== "datafy") return;
      if (e.data.event === "connected") void verificar();
      if (e.data.event === "error") setErro(e.data.message || "A Meta não concluiu a conexão.");
    };
    window.addEventListener("message", aoReceber);
    return () => window.removeEventListener("message", aoReceber);
  }, [verificar]);

  async function gerar() {
    if (!cliente) return;
    limpar();
    setCarregando(true);
    const resp = await fetch("/api/admin/oficial/conectar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: cliente.id }),
    }).catch(() => null);
    const json = await resp?.json().catch(() => null);
    setCarregando(false);
    if (!resp?.ok) return setErro(json?.error ?? "Não foi possível gerar a conexão.");
    if (json.reativado) return setSucesso("O número que o cliente já tinha conectado foi reativado.");
    setConexao({ url: json.url, instanceId: json.instanceId });
  }

  async function vincular() {
    if (!cliente || !token.trim()) return;
    limpar();
    setCarregando(true);
    const resp = await fetch("/api/admin/dispatch/instances", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: cliente.id, nome: nome.trim() || "WhatsApp oficial", token: token.trim(), numeroConectado: numero.trim() || undefined }),
    }).catch(() => null);
    const json = await resp?.json().catch(() => null);
    setCarregando(false);
    if (!resp?.ok) return setErro(json?.error ?? "Não foi possível vincular o canal.");
    setToken("");
    setSucesso("Canal vinculado. O número já aparece em Disparo WhatsApp → Números, na conta do cliente.");
  }

  async function copiar() {
    if (!conexao) return;
    await navigator.clipboard?.writeText(conexao.url).catch(() => undefined);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Conectar o WhatsApp oficial de um cliente</CardTitle>
        <CardDescription>
          Para fazer junto com o cliente (ou por ele): o número fica na conta do cliente e já aparece pronto para as campanhas dele.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="busca-cliente">Cliente</Label>
          {cliente ? (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/40 bg-accent/40 px-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{cliente.nome || cliente.email}</p>
                <p className="truncate text-xs text-muted-foreground">{[cliente.email, cliente.empresa].filter(Boolean).join(" · ")}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => { setCliente(null); limpar(); }}>
                <X className="h-4 w-4" /> Trocar
              </Button>
            </div>
          ) : (
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="busca-cliente" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome, e-mail ou empresa" className="pl-9" />
              {resultados.length > 0 && (
                <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-border bg-card shadow-lg">
                  {resultados.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => { setCliente(c); setBusca(""); limpar(); }}
                        className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-accent"
                      >
                        <span className="text-sm font-medium text-foreground">{c.nome || c.email}</span>
                        <span className="text-xs text-muted-foreground">{[c.email, c.empresa].filter(Boolean).join(" · ")}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="inline-flex self-start rounded-xl border border-border bg-secondary/30 p-1" role="tablist">
          {([["gerar", "Conectar pela Meta"], ["vincular", "Vincular canal existente"]] as const).map(([valor, rotulo]) => (
            <button
              key={valor}
              type="button"
              role="tab"
              aria-selected={modo === valor}
              onClick={() => { setModo(valor); limpar(); }}
              className={cn("rounded-lg px-3 py-1.5 text-sm font-medium transition-colors", modo === valor ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              {rotulo}
            </button>
          ))}
        </div>

        {erro && <Alert variant="destructive"><AlertDescription>{erro}</AlertDescription></Alert>}
        {sucesso && <Alert variant="success"><AlertDescription>{sucesso}</AlertDescription></Alert>}

        {modo === "gerar" ? (
          !parceiroConfigurado ? (
            <p className="text-sm text-muted-foreground">Cadastre o token de conta de parceiro da Datafy em <Link href="/admin/configuracoes" className="font-medium text-primary hover:underline">Chaves e integrações</Link> para usar esta opção.</p>
          ) : conexao ? (
            <div className="flex flex-col gap-3 rounded-xl border border-border p-4">
              <p className="text-sm text-muted-foreground">
                Abra a janela agora (com o cliente na chamada, entrando com o Facebook dele) ou mande o link para ele abrir. O link vale 24 horas e funciona
                uma vez.
              </p>
              <code className="break-all rounded-lg bg-secondary px-2.5 py-1.5 font-mono text-xs text-foreground">{conexao.url}</code>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => window.open(conexao.url, "datafy-conexao", "width=600,height=760")}>
                  <ExternalLink className="h-4 w-4" /> Abrir janela agora
                </Button>
                <Button size="sm" variant="outline" onClick={copiar}>
                  {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copiado ? "Copiado" : "Copiar link"}
                </Button>
                <Button size="sm" variant="outline" onClick={verificar} disabled={carregando}>
                  {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Verificar conexão
                </Button>
              </div>
            </div>
          ) : (
            <Button onClick={gerar} disabled={!cliente || carregando} className="self-start">
              {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />} Gerar conexão
            </Button>
          )
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Para um canal que já existe na Datafy (por exemplo, o primeiro canal assinado no painel deles): cole o token do canal (sk_live_…). O número e os
              IDs vêm do token. Esse canal não é cancelado automaticamente pela plataforma.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="vinc-nome">Nome no Leadmatic</Label>
                <Input id="vinc-nome" value={nome} onChange={(e) => setNome(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="vinc-numero">Número (opcional)</Label>
                <Input id="vinc-numero" value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="5531999998888" />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="vinc-token">Token do canal</Label>
              <Input id="vinc-token" type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="sk_live_…" autoComplete="off" />
            </div>
            <Button onClick={vincular} disabled={!cliente || !token.trim() || carregando} className="self-start">
              {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />} Vincular ao cliente
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
