"use client";

import { useEffect, useState } from "react";
import { X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { FLOW_NODE_TYPES } from "@/lib/flow/node-types";
import type { FlowNode } from "@/lib/database.types";

const DIAS = [
  { value: 1, label: "Seg" }, { value: 2, label: "Ter" }, { value: 3, label: "Qua" },
  { value: 4, label: "Qui" }, { value: 5, label: "Sex" }, { value: 6, label: "Sáb" }, { value: 0, label: "Dom" },
];

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function ListaField({ label, valor, onChange, placeholder }: { label: string; valor: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  return (
    <Campo label={label}>
      <Input
        value={valor.join(", ")}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value.split(",").map((v) => v.trim()).filter(Boolean))}
      />
    </Campo>
  );
}

function useListaFetch<T>(url: string | null): T[] {
  const [dados, setDados] = useState<T[]>([]);
  useEffect(() => {
    if (!url) return;
    let ativo = true;
    fetch(url).then((r) => r.json()).then((d) => {
      if (!ativo) return;
      const chave = Object.keys(d).find((k) => Array.isArray(d[k]));
      setDados(chave ? d[chave] : []);
    }).catch(() => {});
    return () => { ativo = false; };
  }, [url]);
  return dados;
}

function CamposGatilhoAgendado({ config, set }: CamposProps) {
  const diasSemana: number[] = Array.isArray(config.diasSemana) ? (config.diasSemana as number[]) : [];
  return (
    <>
      <Campo label="Dias da semana">
        <div className="flex flex-wrap gap-2">
          {DIAS.map((d) => (
            <label key={d.value} className="flex items-center gap-1.5 rounded-lg border border-border bg-secondary/40 px-2 py-1 text-xs">
              <Checkbox
                checked={diasSemana.includes(d.value)}
                onCheckedChange={(c) => set({ diasSemana: c ? [...diasSemana, d.value] : diasSemana.filter((x) => x !== d.value) })}
              />
              {d.label}
            </label>
          ))}
        </div>
      </Campo>
      <Campo label="Horário(s) (HH:MM, separados por vírgula)">
        <Input value={String(config.horario || "")} placeholder="08:00,18:00" onChange={(e) => set({ horario: e.target.value })} />
      </Campo>
    </>
  );
}

function CamposGatilhoFiltroLeads({ config, set }: CamposProps) {
  return (
    <>
      <Campo label="Nicho contém"><Input value={String(config.nicho || "")} onChange={(e) => set({ nicho: e.target.value })} /></Campo>
      <Campo label="Subnicho contém"><Input value={String(config.subnicho || "")} onChange={(e) => set({ subnicho: e.target.value })} /></Campo>
      <Campo label="UF"><Input value={String(config.uf || "")} maxLength={2} onChange={(e) => set({ uf: e.target.value.toUpperCase() })} /></Campo>
    </>
  );
}

function CamposGatilhoPlanilha({ config, set }: CamposProps) {
  return (
    <>
      <Campo label="ID ou URL da planilha"><Input value={String(config.sheetId || "")} onChange={(e) => set({ sheetId: e.target.value })} /></Campo>
      <Campo label="Nome da aba"><Input value={String(config.abaNome || "")} onChange={(e) => set({ abaNome: e.target.value })} /></Campo>
      <Campo label="Coluna do telefone"><Input value={String(config.colunaTelefone || "telefone")} onChange={(e) => set({ colunaTelefone: e.target.value })} /></Campo>
      <Campo label="Coluna do nome (opcional)"><Input value={String(config.colunaNome || "")} onChange={(e) => set({ colunaNome: e.target.value })} /></Campo>
    </>
  );
}

function CamposExtracaoCnpj({ config, set }: CamposProps) {
  return (
    <>
      <Campo label="Nicho (termo de busca)"><Input value={String(config.nicho || "")} onChange={(e) => set({ nicho: e.target.value })} /></Campo>
      <Campo label="CNAE"><Input value={String(config.cnae || "")} onChange={(e) => set({ cnae: e.target.value })} /></Campo>
      <Campo label="UF"><Input value={String(config.uf || "")} maxLength={2} onChange={(e) => set({ uf: e.target.value.toUpperCase() })} /></Campo>
      <Campo label="Cidade/Município"><Input value={String(config.cidade || "")} onChange={(e) => set({ cidade: e.target.value })} /></Campo>
      <Campo label="Porte"><Input value={String(config.porte || "")} placeholder="MICRO, PEQUENO..." onChange={(e) => set({ porte: e.target.value })} /></Campo>
      <Campo label="Limite de resultados">
        <Input type="number" min={1} max={1000} value={Number(config.limite ?? 100)} onChange={(e) => set({ limite: Number(e.target.value) })} />
      </Campo>
    </>
  );
}

function CamposExtracaoMaps({ config, set }: CamposProps) {
  return (
    <>
      <Campo label="Nicho (termo de busca)"><Input value={String(config.nicho || "")} onChange={(e) => set({ nicho: e.target.value })} /></Campo>
      <Campo label="Cidade"><Input value={String(config.cidade || "")} onChange={(e) => set({ cidade: e.target.value })} /></Campo>
      <Campo label="Estado (UF)"><Input value={String(config.estado || "")} maxLength={2} onChange={(e) => set({ estado: e.target.value.toUpperCase() })} /></Campo>
      <Campo label="Limite de resultados">
        <Input type="number" min={1} max={500} value={Number(config.limite ?? 60)} onChange={(e) => set({ limite: Number(e.target.value) })} />
      </Campo>
    </>
  );
}

function CamposExtracaoInstagram({ config, set }: CamposProps) {
  return (
    <>
      <Campo label="Perfil alvo (@usuario)"><Input value={String(config.termoBusca || "")} onChange={(e) => set({ termoBusca: e.target.value })} /></Campo>
      <Campo label="Limite de resultados">
        <Input type="number" min={1} max={500} value={Number(config.limite ?? 60)} onChange={(e) => set({ limite: Number(e.target.value) })} />
      </Campo>
    </>
  );
}

function CamposExtracaoLinkedin({ config, set }: CamposProps) {
  const cargos = Array.isArray(config.cargos) ? (config.cargos as string[]) : [];
  const localizacoes = Array.isArray(config.localizacoes) ? (config.localizacoes as string[]) : [];
  return (
    <>
      <ListaField label="Cargos (separados por vírgula)" valor={cargos} onChange={(v) => set({ cargos: v })} placeholder="CEO, Diretor comercial" />
      <ListaField label="Localizações (separadas por vírgula)" valor={localizacoes} onChange={(v) => set({ localizacoes: v })} placeholder="São Paulo, Brasil" />
      <Campo label="Palavra-chave"><Input value={String(config.palavraChave || "")} onChange={(e) => set({ palavraChave: e.target.value })} /></Campo>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={Boolean(config.buscarEmail)} onCheckedChange={(c) => set({ buscarEmail: Boolean(c) })} />
        Buscar e-mail
      </label>
      <Campo label="Limite de resultados">
        <Input type="number" min={1} max={500} value={Number(config.limite ?? 100)} onChange={(e) => set({ limite: Number(e.target.value) })} />
      </Campo>
    </>
  );
}

function CamposFonteHistorico({ config, set }: CamposProps) {
  const pesquisas = useListaFetch<{ id: string; nicho: string; localidade: string; total_results: number; fonte: string }>("/api/historico");
  return (
    <Campo label="Pesquisa do histórico">
      <Select value={String(config.searchId || "")} onValueChange={(v) => set({ searchId: v })}>
        <SelectTrigger><SelectValue placeholder="Selecione uma pesquisa" /></SelectTrigger>
        <SelectContent>
          {pesquisas.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.fonte} · {p.nicho || p.localidade || "—"} · {p.total_results} lead(s)
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Campo>
  );
}

function CamposEnriquecimentoIa({ config, set }: CamposProps) {
  return (
    <>
      <Campo label="Nível de raciocínio">
        <Select value={String(config.nivelRaciocinio || "equilibrado")} onValueChange={(v) => set({ nivelRaciocinio: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="rapido">Rápido</SelectItem>
            <SelectItem value="equilibrado">Equilibrado</SelectItem>
            <SelectItem value="profundo">Profundo</SelectItem>
          </SelectContent>
        </Select>
      </Campo>
      {([["buscarSocios", "Buscar sócios"], ["buscarFundacao", "Buscar data de fundação"], ["buscarProcessos", "Buscar processos (Jusbrasil)"]] as const).map(([chave, label]) => (
        <label key={chave} className="flex items-center gap-2 text-sm">
          <Checkbox checked={config[chave] !== false} onCheckedChange={(c) => set({ [chave]: Boolean(c) })} />
          {label}
        </label>
      ))}
    </>
  );
}

function CamposDisparoWhatsapp({ config, set }: CamposProps) {
  const campanhas = useListaFetch<{ id: string; nome: string; status: string }>("/api/dispatch/campaigns");
  return (
    <Campo label="Campanha de disparo">
      <Select value={String(config.campaignId || "")} onValueChange={(v) => set({ campaignId: v })}>
        <SelectTrigger><SelectValue placeholder="Selecione uma campanha" /></SelectTrigger>
        <SelectContent>
          {campanhas.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome} ({c.status})</SelectItem>)}
        </SelectContent>
      </Select>
    </Campo>
  );
}

function CamposDestinoSheets({ config, set }: CamposProps) {
  const sheetId = String(config.sheetId || "");
  const planilhas = useListaFetch<{ id: string; name: string }>("/api/integrations/google-sheets/spreadsheets");
  const abas = useListaFetch<string>(sheetId ? `/api/integrations/google-sheets/spreadsheets?sheetId=${encodeURIComponent(sheetId)}` : null);
  return (
    <>
      <Campo label="Planilha">
        <Select value={sheetId} onValueChange={(v) => set({ sheetId: v, aba: "" })}>
          <SelectTrigger><SelectValue placeholder="Selecione a planilha" /></SelectTrigger>
          <SelectContent>
            {planilhas.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </Campo>
      <Campo label="Aba">
        <Select value={String(config.aba || "")} onValueChange={(v) => set({ aba: v })}>
          <SelectTrigger><SelectValue placeholder="Selecione a aba" /></SelectTrigger>
          <SelectContent>
            {abas.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
      </Campo>
      <Campo label="Modo">
        <Select value={String(config.modo || "acrescentar")} onValueChange={(v) => set({ modo: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="acrescentar">Acrescentar linhas</SelectItem>
            <SelectItem value="substituir">Substituir conteúdo</SelectItem>
          </SelectContent>
        </Select>
      </Campo>
    </>
  );
}

interface CamposProps {
  config: Record<string, unknown>;
  set: (patch: Record<string, unknown>) => void;
}

function CamposDoNo({ node, config, set }: { node: FlowNode } & CamposProps) {
  switch (node.tipo) {
    case "gatilho_agendado": return <CamposGatilhoAgendado config={config} set={set} />;
    case "gatilho_filtro_leads": return <CamposGatilhoFiltroLeads config={config} set={set} />;
    case "gatilho_planilha": return <CamposGatilhoPlanilha config={config} set={set} />;
    case "gatilho_manual": return <p className="text-sm text-muted-foreground">Sem configuração — dispare pelo botão &quot;Executar agora&quot;.</p>;
    case "extracao_cnpj": return <CamposExtracaoCnpj config={config} set={set} />;
    case "extracao_maps": return <CamposExtracaoMaps config={config} set={set} />;
    case "extracao_instagram": return <CamposExtracaoInstagram config={config} set={set} />;
    case "extracao_linkedin": return <CamposExtracaoLinkedin config={config} set={set} />;
    case "fonte_historico": return <CamposFonteHistorico config={config} set={set} />;
    case "enriquecimento_ia": return <CamposEnriquecimentoIa config={config} set={set} />;
    case "disparo_whatsapp": return <CamposDisparoWhatsapp config={config} set={set} />;
    case "disparo_email": return <p className="text-sm text-muted-foreground">Disparo por e-mail ainda não está disponível.</p>;
    case "destino_sheets": return <CamposDestinoSheets config={config} set={set} />;
    default: return null;
  }
}

export function FlowNodeConfigPanel({
  node, onChange, onClose, onDelete,
}: {
  node: FlowNode;
  onChange: (config: Record<string, unknown>) => void;
  onClose: () => void;
  onDelete: () => void;
}) {
  const meta = FLOW_NODE_TYPES[node.tipo];
  const config = (node.config || {}) as Record<string, unknown>;
  const set = (patch: Record<string, unknown>) => onChange({ ...config, ...patch });

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground">{meta.label}</p>
          <p className="text-xs text-muted-foreground">{meta.descricao}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
      </div>

      <div className="flex flex-col gap-4">
        <CamposDoNo node={node} config={config} set={set} />
      </div>

      <Button variant="outline" size="sm" onClick={onDelete} className="mt-auto text-destructive hover:border-destructive">
        <Trash2 className="h-3.5 w-3.5" /> Remover nó
      </Button>
    </div>
  );
}
