"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, FilePlus2, FolderOpen, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { criarPlanilhaNova, escolherPlanilhaNoGoogle, extrairIdPlanilha } from "@/components/sheets/seletor-google";

export interface ValorPlanilha {
  sheetId: string;
  aba: string;
}

/**
 * Planilha + aba para automações e monitoramentos: lista as planilhas que a
 * plataforma já enxerga, abre o seletor do Google para escolher outra, cria
 * uma nova e avisa (com o botão para liberar) quando a planilha configurada
 * não está acessível.
 */
export function CampoPlanilha({
  valor,
  onChange,
  idPrefixo,
  rotuloAba = "Aba",
}: {
  valor: ValorPlanilha;
  onChange: (v: ValorPlanilha) => void;
  idPrefixo: string;
  rotuloAba?: string;
}) {
  const [planilhas, setPlanilhas] = useState<{ id: string; name: string }[]>([]);
  const [abas, setAbas] = useState<string[] | null>(null);
  const [semAcesso, setSemAcesso] = useState(false);
  const [ocupado, setOcupado] = useState<"escolher" | "criar" | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);
  const [titulo, setTitulo] = useState("Leads Leadmatic");
  // Sobe quando a mesma planilha é liberada no seletor: recarrega as abas.
  const [recarga, setRecarga] = useState(0);
  // Configurações antigas guardavam a URL colada; para o Google vale o ID.
  const idPlanilha = extrairIdPlanilha(valor.sheetId);
  const ultimo = useRef({ valor, onChange });
  useEffect(() => {
    ultimo.current = { valor, onChange };
  });

  useEffect(() => {
    let ativo = true;
    fetch("/api/integrations/google-sheets/spreadsheets")
      .then((r) => r.json())
      .then((d) => ativo && setPlanilhas(d.planilhas ?? []))
      .catch(() => undefined);
    return () => { ativo = false; };
  }, []);

  // Abas da planilha escolhida; 403 = planilha configurada que a plataforma não pode abrir (não passou pelo seletor).
  useEffect(() => {
    if (!idPlanilha) return;
    let ativo = true;
    fetch(`/api/integrations/google-sheets/spreadsheets?sheetId=${encodeURIComponent(idPlanilha)}`)
      .then(async (r) => ({ ok: r.ok, d: await r.json().catch(() => ({})) }))
      .then(({ ok, d }) => {
        if (!ativo) return;
        setSemAcesso(!ok && Boolean(d.semAcesso));
        const lista: string[] = ok ? (d.abas ?? []) : [];
        setAbas(lista);
        // Planilha recém-escolhida (aba vazia): já sugere a primeira aba.
        const { valor: atual, onChange: mudar } = ultimo.current;
        if (lista.length && !atual.aba) mudar({ ...atual, aba: lista[0] });
      })
      .catch(() => ativo && setAbas([]));
    return () => { ativo = false; };
  }, [idPlanilha, recarga]);

  function escolher(id: string, abasConhecidas?: string[]) {
    setErro(null);
    setSemAcesso(false);
    setAbas(abasConhecidas ?? null);
    onChange({ sheetId: id, aba: abasConhecidas?.[0] ?? "" });
  }

  async function abrirSeletor(arquivoId?: string) {
    setErro(null);
    setOcupado("escolher");
    try {
      const p = await escolherPlanilhaNoGoogle({ arquivoId });
      if (!p) return;
      setPlanilhas((lista) => (lista.some((x) => x.id === p.id) ? lista : [p, ...lista]));
      if (p.id === idPlanilha) {
        setSemAcesso(false);
        setAbas(null);
        setRecarga((n) => n + 1);
      } else {
        escolher(p.id);
      }
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setOcupado(null);
    }
  }

  async function criar() {
    if (!titulo.trim()) return;
    setErro(null);
    setOcupado("criar");
    try {
      const p = await criarPlanilhaNova(titulo.trim());
      setPlanilhas((lista) => [{ id: p.id, name: p.name }, ...lista]);
      setCriando(false);
      escolher(p.id, p.abas);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setOcupado(null);
    }
  }

  const abasLista = abas ?? [];
  const valorNaLista = planilhas.some((p) => p.id === valor.sheetId);
  const rotuloSemLista = valor.sheetId === idPlanilha ? `Planilha configurada (${idPlanilha.slice(0, 10)}…)` : "Planilha configurada (link colado)";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${idPrefixo}-planilha`}>Planilha</Label>
        {/* Dentro de <form>, o Select manda "" quando as opções mudam: ignora. */}
        <Select value={valor.sheetId} onValueChange={(v) => v && v !== valor.sheetId && escolher(v)}>
          <SelectTrigger id={`${idPrefixo}-planilha`}><SelectValue placeholder="Selecione a planilha" /></SelectTrigger>
          <SelectContent>
            {valor.sheetId && !valorNaLista && <SelectItem value={valor.sheetId}>{rotuloSemLista}</SelectItem>}
            {planilhas.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => abrirSeletor()} disabled={ocupado !== null}>
            {ocupado === "escolher" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderOpen className="h-4 w-4" />} Escolher do Google Drive
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setCriando((v) => !v)} disabled={ocupado !== null}>
            <FilePlus2 className="h-4 w-4" /> Criar planilha nova
          </Button>
        </div>
        {criando && (
          <div className="flex gap-2">
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} aria-label="Nome da planilha nova" maxLength={120} />
            <Button type="button" size="sm" onClick={criar} disabled={!titulo.trim() || ocupado !== null} className="h-10 shrink-0">
              {ocupado === "criar" ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Criar
            </Button>
          </div>
        )}
        {semAcesso && (
          <div className="flex flex-col gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-foreground">
            <span className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
              A plataforma ainda não tem acesso a esta planilha. Libere escolhendo-a no Google Drive (uma vez só).
            </span>
            <Button type="button" size="sm" variant="outline" className="self-start" onClick={() => abrirSeletor(idPlanilha)} disabled={ocupado !== null}>
              Liberar acesso
            </Button>
          </div>
        )}
        {erro && <p className="text-xs text-destructive">{erro}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${idPrefixo}-aba`}>{rotuloAba}</Label>
        {abasLista.length > 0 ? (
          <Select value={abasLista.includes(valor.aba) ? valor.aba : ""} onValueChange={(v) => v && onChange({ ...valor, aba: v })}>
            <SelectTrigger id={`${idPrefixo}-aba`}><SelectValue placeholder={valor.aba ? `${valor.aba} (não encontrada)` : "Selecione a aba"} /></SelectTrigger>
            <SelectContent>
              {abasLista.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        ) : (
          <Input
            id={`${idPrefixo}-aba`}
            value={valor.aba}
            onChange={(e) => onChange({ ...valor, aba: e.target.value })}
            placeholder={valor.sheetId && abas === null ? "Carregando abas…" : "Nome da aba"}
          />
        )}
      </div>
    </div>
  );
}

/** Para uma planilha já configurada (monitoramento ativo): avisa e oferece liberar o acesso se a plataforma não consegue abri-la. */
export function AvisoAcessoPlanilha({ sheetId: bruto }: { sheetId: string }) {
  const sheetId = extrairIdPlanilha(bruto);
  const [semAcesso, setSemAcesso] = useState(false);
  const [recarga, setRecarga] = useState(0);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    fetch(`/api/integrations/google-sheets/spreadsheets?sheetId=${encodeURIComponent(sheetId)}`)
      .then(async (r) => ({ ok: r.ok, d: await r.json().catch(() => ({})) }))
      .then(({ ok, d }) => ativo && setSemAcesso(!ok && Boolean(d.semAcesso)))
      .catch(() => undefined);
    return () => { ativo = false; };
  }, [sheetId, recarga]);

  if (!semAcesso) return null;

  async function liberar() {
    setErro(null);
    try {
      if (await escolherPlanilhaNoGoogle({ arquivoId: sheetId })) setRecarga((n) => n + 1);
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-foreground">
      <span className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
        A plataforma não está conseguindo ler esta planilha. Libere o acesso escolhendo-a no Google Drive (uma vez só).
      </span>
      <Button type="button" size="sm" variant="outline" className="self-start" onClick={liberar}>Liberar acesso</Button>
      {erro && <p className="text-destructive">{erro}</p>}
    </div>
  );
}
