"use client";

import { useEffect, useState } from "react";
import { X, Trash2, Plus, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Collapsible } from "@/components/ui/collapsible";
import { MultiSelect, type MultiSelectOption } from "@/components/search/multi-select";
import { FLOW_NODE_TYPES, FILTRO_OPERADORES, type VariavelEntrada } from "@/lib/flow/node-types";
import { CNAES } from "@/lib/data/cnaes";
import { ESTADOS } from "@/lib/data/estados";
import { NOMES_NICHOS } from "@/lib/data/nichos";
import { LINKEDIN_INDUSTRIES } from "@/lib/data/linkedin-industries";
import { LEAD_FIELD_GROUPS } from "./lead-field-reference";
import type { FlowNode } from "@/lib/database.types";

const DIAS = [
  { value: 1, label: "Seg" }, { value: 2, label: "Ter" }, { value: 3, label: "Qua" },
  { value: 4, label: "Qui" }, { value: 5, label: "Sex" }, { value: 6, label: "Sáb" }, { value: 0, label: "Dom" },
];

const CNAE_OPTIONS: MultiSelectOption[] = CNAES.map((c) => ({ value: c.codigo, label: `${c.codigo} — ${c.descricao}`, group: c.setor }));
const UF_OPTIONS: MultiSelectOption[] = Object.entries(ESTADOS).map(([sigla, nome]) => ({ value: sigla, label: `${sigla} — ${nome}` }));
const PORTE_OPTIONS: MultiSelectOption[] = [
  { value: "01", label: "Microempresa (ME)" },
  { value: "03", label: "Empresa de Pequeno Porte (EPP)" },
  { value: "05", label: "Demais" },
];
const OPERADOR_LABEL: Record<(typeof FILTRO_OPERADORES)[number], string> = {
  preenchido: "está preenchido",
  vazio: "está vazio",
  contem: "contém",
  nao_contem: "não contém",
  igual: "é igual a",
  diferente: "é diferente de",
};

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function CampoCheckbox({ checked, onCheckedChange, children }: { checked: boolean; onCheckedChange: (c: boolean) => void; children: React.ReactNode }) {
  return (
    <label className="flex items-center gap-2 text-sm text-foreground">
      <Checkbox checked={checked} onCheckedChange={(c) => onCheckedChange(Boolean(c))} />
      {children}
    </label>
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

function CampoRadio<T extends string>({
  label, value, onChange, opcoes,
}: { label: string; value: T; onChange: (v: T) => void; opcoes: ReadonlyArray<readonly [T, string]> }) {
  return (
    <Campo label={label}>
      <RadioGroup value={value} onValueChange={(v) => onChange(v as T)} className="flex flex-col gap-2">
        {opcoes.map(([v, lbl]) => (
          <label key={v || "_vazio"} className="flex items-center gap-2 text-sm">
            <RadioGroupItem value={v} />
            {lbl}
          </label>
        ))}
      </RadioGroup>
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

function TokenChip({ token }: { token: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <button
      type="button"
      title="Clique para copiar"
      onClick={() => {
        navigator.clipboard?.writeText(token).catch(() => {});
        setCopiado(true);
        setTimeout(() => setCopiado(false), 1200);
      }}
      className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary/50 px-1.5 py-0.5 font-mono text-[11px] text-foreground transition-colors hover:border-primary/50 hover:bg-secondary"
    >
      {copiado ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
      {token}
    </button>
  );
}

/**
 * Torna as variáveis de fato DESCOBRÍVEIS — em vez de só uma dica de
 * sintaxe, lista os tokens reais que existem nesse fluxo (variáveis do
 * gatilho manual) e um cheat-sheet dos campos de lead mais comuns, cada um
 * clicável pra copiar. `{{lead.campo}}` é sempre o PRIMEIRO lead do lote
 * atual (o motor roda cada nó uma vez por execução, não uma vez por lead).
 */
function VariaveisDisponiveis({ variaveisFlow }: { variaveisFlow: VariavelEntrada[] }) {
  return (
    <Collapsible
      defaultOpen
      className="rounded-lg border border-dashed border-border bg-secondary/20 p-2.5"
      trigger={<span className="text-xs font-semibold text-foreground">Variáveis disponíveis</span>}
    >
      <div className="flex flex-col gap-2.5 pt-2.5">
        <div className="flex flex-col gap-1.5">
          <p className="text-[11px] font-medium text-muted-foreground">Entrada do gatilho manual</p>
          {variaveisFlow.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {variaveisFlow.filter((v) => v.chave).map((v) => <TokenChip key={v.chave} token={`{{variaveis.${v.chave}}}`} />)}
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              Nenhuma declarada ainda — adicione no nó de gatilho manual pra poder usar aqui.
            </p>
          )}
        </div>
        {LEAD_FIELD_GROUPS.map((g) => (
          <div key={g.grupo} className="flex flex-col gap-1.5">
            <p className="text-[11px] font-medium text-muted-foreground">{g.grupo}</p>
            <div className="flex flex-wrap gap-1.5">
              {g.campos.map((c) => <TokenChip key={c.chave} token={`{{lead.${c.chave}}}`} />)}
            </div>
          </div>
        ))}
        <p className="text-[11px] text-muted-foreground">
          <code className="rounded bg-secondary px-1">{"{{lead.campo}}"}</code> usa o PRIMEIRO lead do lote atual — só
          resolve a partir do nó seguinte a uma extração/histórico que já rodou (não funciona no primeiro nó de
          extração, antes de haver lote nenhum). A lista de campos acima é um guia — só existe de verdade se a
          origem do lote (CNPJ, Maps, LinkedIn, enriquecimento…) realmente o preencheu.
        </p>
      </div>
    </Collapsible>
  );
}

// ── Gatilhos ─────────────────────────────────────────────────────

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

function CamposGatilhoManual({ config, set }: CamposProps) {
  const variaveis = Array.isArray(config.variaveis) ? (config.variaveis as VariavelEntrada[]) : [];

  function atualizar(i: number, patch: Partial<VariavelEntrada>) {
    set({ variaveis: variaveis.map((v, idx) => (idx === i ? { ...v, ...patch } : v)) });
  }
  function remover(i: number) {
    set({ variaveis: variaveis.filter((_, idx) => idx !== i) });
  }

  return (
    <>
      <p className="text-xs text-muted-foreground">
        Parâmetros de entrada — pedidos a cada &quot;Executar agora&quot; e disponíveis nos nós seguintes via <code className="rounded bg-secondary px-1">{"{{variaveis.chave}}"}</code>.
      </p>
      {variaveis.map((v, i) => (
        <div key={i} className="flex flex-col gap-2 rounded-lg border border-border bg-secondary/30 p-2.5">
          <div className="flex items-center gap-2">
            <Input
              value={v.chave}
              onChange={(e) => atualizar(i, { chave: e.target.value.replace(/[^a-zA-Z0-9_]/g, "") })}
              placeholder="chave (ex: cidade)"
            />
            <Button type="button" variant="ghost" size="icon" onClick={() => remover(i)}><X className="h-3.5 w-3.5" /></Button>
          </div>
          <Input value={v.label} onChange={(e) => atualizar(i, { label: e.target.value })} placeholder="Rótulo (opcional)" />
          <Input value={v.padrao} onChange={(e) => atualizar(i, { padrao: e.target.value })} placeholder="Valor padrão" />
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => set({ variaveis: [...variaveis, { chave: "", label: "", padrao: "" }] })}
      >
        <Plus className="h-3.5 w-3.5" /> Nova variável
      </Button>
    </>
  );
}

// ── Extração ─────────────────────────────────────────────────────

function CamposExtracaoCnpj({ config, set }: CamposProps) {
  const recuperacaoJudicial = Boolean(config.recuperacaoJudicial);
  const cnaes = Array.isArray(config.cnaes) ? (config.cnaes as string[]) : [];
  const uf = Array.isArray(config.uf) ? (config.uf as string[]) : [];
  const municipio = Array.isArray(config.municipio) ? (config.municipio as string[]) : [];
  const porte = Array.isArray(config.porte) ? (config.porte as string[]) : [];
  const mapsModo = String(config.mapsModo || "nao_usar");

  return (
    <>
      <CampoCheckbox checked={recuperacaoJudicial} onCheckedChange={(c) => set({ recuperacaoJudicial: c })}>
        Modo Recuperação Judicial (dispensa CNAE)
      </CampoCheckbox>

      {!recuperacaoJudicial && (
        <>
          <Campo label="CNAEs">
            <MultiSelect options={CNAE_OPTIONS} selected={cnaes} onChange={(v) => set({ cnaes: v })} placeholder="Buscar código, descrição ou setor…" />
          </Campo>
          <Campo label="Ou CNAEs manuais (separados por vírgula)">
            <Input value={String(config.cnaeManual || "")} onChange={(e) => set({ cnaeManual: e.target.value })} placeholder="6911701, 6912500" />
          </Campo>
          <CampoRadio
            label="Tipo de CNAE"
            value={(config.cnaeTipo as string) || "principal"}
            onChange={(v) => set({ cnaeTipo: v })}
            opcoes={[["principal", "Primário"], ["secundario", "Secundário"], ["ambos", "Primário ou Secundário"]]}
          />
        </>
      )}

      <Campo label="Estados (UF)">
        <MultiSelect options={UF_OPTIONS} selected={uf} onChange={(v) => set({ uf: v })} placeholder="Buscar estado…" />
      </Campo>
      <ListaField label="Municípios (opcional, separados por vírgula)" valor={municipio} onChange={(v) => set({ municipio: v })} placeholder="São Paulo, Campinas" />

      <Campo label="Porte">
        <MultiSelect options={PORTE_OPTIONS} selected={porte} onChange={(v) => set({ porte: v })} placeholder="Todos os portes" />
      </Campo>
      <CampoRadio
        label="Matriz/Filial"
        value={(config.matrizFilial as string) || ""}
        onChange={(v) => set({ matrizFilial: v })}
        opcoes={[["", "Todos"], ["MATRIZ", "Somente Matriz"], ["FILIAL", "Somente Filial"]]}
      />
      <CampoRadio
        label="Simples Nacional"
        value={(config.simplesOptante as string) || "indiferente"}
        onChange={(v) => set({ simplesOptante: v })}
        opcoes={[["indiferente", "Indiferente"], ["apenas", "Apenas optantes"], ["excluir", "Excluir optantes"]]}
      />
      <CampoRadio
        label="MEI"
        value={(config.meiOptante as string) || "indiferente"}
        onChange={(v) => set({ meiOptante: v })}
        opcoes={[["indiferente", "Indiferente"], ["apenas", "Apenas MEI"], ["excluir", "Excluir MEI"]]}
      />

      <div className="grid grid-cols-2 gap-2">
        <Campo label="Abertura — de">
          <Input type="date" value={String(config.dataAberturaInicio || "")} onChange={(e) => set({ dataAberturaInicio: e.target.value })} />
        </Campo>
        <Campo label="Abertura — até">
          <Input type="date" value={String(config.dataAberturaFim || "")} onChange={(e) => set({ dataAberturaFim: e.target.value })} />
        </Campo>
        <Campo label="Capital mín. (R$)">
          <Input type="number" min={0} value={(config.capitalMin as number) ?? ""} onChange={(e) => set({ capitalMin: e.target.value ? Number(e.target.value) : null })} />
        </Campo>
        <Campo label="Capital máx. (R$)">
          <Input type="number" min={0} value={(config.capitalMax as number) ?? ""} onChange={(e) => set({ capitalMax: e.target.value ? Number(e.target.value) : null })} />
        </Campo>
      </div>

      <CampoRadio
        label="Tipo de telefone"
        value={(config.tipoTelefone as string) || "todos"}
        onChange={(v) => set({ tipoTelefone: v })}
        opcoes={[["todos", "Todos"], ["celular", "Somente celular"], ["fixo", "Somente fixo"]]}
      />
      <CampoCheckbox checked={config.comTelefone !== false} onCheckedChange={(c) => set({ comTelefone: c })}>Apenas com telefone</CampoCheckbox>
      <CampoCheckbox checked={Boolean(config.comEmail)} onCheckedChange={(c) => set({ comEmail: c })}>Apenas com e-mail</CampoCheckbox>
      <CampoCheckbox checked={config.excluirEmailContab !== false} onCheckedChange={(c) => set({ excluirEmailContab: c })}>Excluir e-mails de contabilidade</CampoCheckbox>
      <CampoCheckbox checked={config.apenasNovos !== false} onCheckedChange={(c) => set({ apenasNovos: c })}>Apenas leads novos</CampoCheckbox>

      <CampoRadio
        label="Google Maps"
        value={mapsModo}
        onChange={(v) => set({ mapsModo: v })}
        opcoes={[
          ["nao_usar", "Não usar"],
          ["enriquecer", "Enriquecer (avaliação, telefone extra, site)"],
          ["filtrar", "Filtrar (manter só quem tem perfil no Maps)"],
          ["filtrar_enriquecer", "Filtrar e enriquecer"],
        ]}
      />
      {(mapsModo === "filtrar" || mapsModo === "filtrar_enriquecer") && (
        <Campo label="Mínimo de avaliações no Maps">
          <Input type="number" min={0} value={Number(config.minAvaliacoes ?? 0)} onChange={(e) => set({ minAvaliacoes: Number(e.target.value) })} />
        </Campo>
      )}

      <Campo label="Limite de resultados (até 2000)">
        <Input type="number" min={1} max={2000} value={Number(config.limite ?? 300)} onChange={(e) => set({ limite: Number(e.target.value) })} />
      </Campo>
    </>
  );
}

function CamposExtracaoMaps({ config, set }: CamposProps) {
  const cidades = Array.isArray(config.cidades) ? (config.cidades as string[]) : [];
  const estados = Array.isArray(config.estados) ? (config.estados as string[]) : [];
  return (
    <>
      <Campo label="Nicho (catálogo)">
        <Select value={String(config.nicho || "__custom")} onValueChange={(v) => set({ nicho: v === "__custom" ? "" : v })}>
          <SelectTrigger><SelectValue placeholder="Escolha um nicho" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__custom">Personalizado (usar termo abaixo)</SelectItem>
            {NOMES_NICHOS.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
          </SelectContent>
        </Select>
      </Campo>
      {!config.nicho && (
        <Campo label="Termo de busca personalizado">
          <Input value={String(config.queryCustom || "")} onChange={(e) => set({ queryCustom: e.target.value })} placeholder="Ex: pet shop, barbearia…" />
        </Campo>
      )}
      <Campo label="Subnicho (opcional)"><Input value={String(config.subnicho || "")} onChange={(e) => set({ subnicho: e.target.value })} /></Campo>

      <ListaField label="Cidades (opcional, separadas por vírgula)" valor={cidades} onChange={(v) => set({ cidades: v })} placeholder="São Paulo, Campinas" />
      <Campo label="Estado(s) (UF)">
        <MultiSelect options={UF_OPTIONS} selected={estados} onChange={(v) => set({ estados: v })} placeholder="Buscar estado…" />
      </Campo>
      <p className="text-xs text-muted-foreground">Com cidade(s) preenchida(s), selecione exatamente 1 estado. Sem cidade, pode escolher vários estados (busca ampla).</p>

      <CampoCheckbox checked={config.showPhone !== false} onCheckedChange={(c) => set({ showPhone: c })}>Buscar telefone e site</CampoCheckbox>
      <CampoCheckbox checked={config.showRating !== false} onCheckedChange={(c) => set({ showRating: c })}>Incluir avaliação</CampoCheckbox>
      <CampoCheckbox checked={config.apenasNovos !== false} onCheckedChange={(c) => set({ apenasNovos: c })}>Apenas leads novos</CampoCheckbox>

      <Campo label="Limite de resultados">
        <Input type="number" min={1} max={500} value={Number(config.limite ?? 60)} onChange={(e) => set({ limite: Number(e.target.value) })} />
      </Campo>
    </>
  );
}

function CamposExtracaoInstagram({ config, set }: CamposProps) {
  return (
    <>
      <CampoRadio
        label="Tipo"
        value={(config.tipo as string) || "seguidores"}
        onChange={(v) => set({ tipo: v })}
        opcoes={[["seguidores", "Seguidores"], ["seguindo", "Seguindo"]]}
      />
      <Campo label="Username ou URL do perfil"><Input value={String(config.termoBusca || "")} onChange={(e) => set({ termoBusca: e.target.value })} /></Campo>
      <CampoCheckbox checked={config.apenasNovos !== false} onCheckedChange={(c) => set({ apenasNovos: c })}>Apenas leads novos</CampoCheckbox>
      <Campo label="Limite de resultados">
        <Input type="number" min={100} max={1000} value={Number(config.limite ?? 200)} onChange={(e) => set({ limite: Number(e.target.value) })} />
      </Campo>
    </>
  );
}

function CamposExtracaoLinkedin({ config, set }: CamposProps) {
  const cargos = Array.isArray(config.cargos) ? (config.cargos as string[]) : [];
  const localizacoes = Array.isArray(config.localizacoes) ? (config.localizacoes as string[]) : [];
  const industrias = Array.isArray(config.industrias) ? (config.industrias as string[]) : [];
  return (
    <>
      <ListaField label="Cargos (separados por vírgula)" valor={cargos} onChange={(v) => set({ cargos: v })} placeholder="CEO, Diretor comercial" />
      <ListaField label="Localizações (separadas por vírgula)" valor={localizacoes} onChange={(v) => set({ localizacoes: v })} placeholder="São Paulo, Brasil" />
      <Campo label="Tipo de empresa (setor/indústria)">
        <MultiSelect options={LINKEDIN_INDUSTRIES} selected={industrias} onChange={(v) => set({ industrias: v })} placeholder="Buscar setor…" />
      </Campo>
      <Campo label="Palavra-chave"><Input value={String(config.palavraChave || "")} onChange={(e) => set({ palavraChave: e.target.value })} /></Campo>
      <CampoCheckbox checked={Boolean(config.buscarEmail)} onCheckedChange={(c) => set({ buscarEmail: c })}>Buscar e-mail</CampoCheckbox>
      <CampoCheckbox checked={config.apenasNovos !== false} onCheckedChange={(c) => set({ apenasNovos: c })}>Apenas leads novos</CampoCheckbox>
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

// ── Enriquecimento ───────────────────────────────────────────────

function CamposEnriquecimentoIa({ config, set }: CamposProps) {
  const camposCustomizados = Array.isArray(config.camposCustomizados) ? (config.camposCustomizados as string[]) : [];
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
        <CampoCheckbox key={chave} checked={config[chave] !== false} onCheckedChange={(c) => set({ [chave]: c })}>{label}</CampoCheckbox>
      ))}
      <Campo label="Outros dados pra IA tentar descobrir (um por linha)">
        <Textarea
          rows={3}
          value={camposCustomizados.join("\n")}
          onChange={(e) => set({ camposCustomizados: e.target.value.split("\n").map((v) => v.trim()).filter(Boolean) })}
          placeholder={"Número de funcionários\nFaturamento estimado"}
        />
      </Campo>
      <p className="text-xs text-muted-foreground">
        O resultado (empresa, cargo, site, resumo…) é mesclado nos próprios leads do fluxo — qualquer nó de exportação ou disparo depois deste já tem acesso a esses campos.
      </p>
    </>
  );
}

function CamposEnriquecimentoMaps({ config, set }: CamposProps) {
  const filtrar = Boolean(config.filtrar);
  return (
    <>
      <CampoCheckbox checked={config.showPhone !== false} onCheckedChange={(c) => set({ showPhone: c })}>Preencher telefone/site do Maps quando faltar</CampoCheckbox>
      <CampoCheckbox checked={filtrar} onCheckedChange={(c) => set({ filtrar: c })}>Filtrar — manter só quem tem perfil no Maps</CampoCheckbox>
      {filtrar && (
        <Campo label="Mínimo de avaliações">
          <Input type="number" min={0} value={Number(config.minAvaliacoes ?? 0)} onChange={(e) => set({ minAvaliacoes: Number(e.target.value) })} />
        </Campo>
      )}
    </>
  );
}

// ── Controle de fluxo ─────────────────────────────────────────────

function CamposFiltroLeads({ config, set }: CamposProps) {
  return (
    <>
      <Campo label="Campo">
        <Input value={String(config.campo || "")} onChange={(e) => set({ campo: e.target.value })} placeholder="email, uf, enriquecimento_status…" />
      </Campo>
      <Campo label="Condição">
        <Select value={String(config.operador || "preenchido")} onValueChange={(v) => set({ operador: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {FILTRO_OPERADORES.map((op) => <SelectItem key={op} value={op}>{OPERADOR_LABEL[op]}</SelectItem>)}
          </SelectContent>
        </Select>
      </Campo>
      {!["preenchido", "vazio"].includes(String(config.operador || "preenchido")) && (
        <Campo label="Valor">
          <Input value={String(config.valor || "")} onChange={(e) => set({ valor: e.target.value })} />
        </Campo>
      )}
      <p className="text-xs text-muted-foreground">Leads que não baterem a condição saem do fluxo a partir daqui (não é ramificação — só reduz o lote).</p>
    </>
  );
}

function CamposEspera({ config, set }: CamposProps) {
  return (
    <Campo label="Esperar (minutos)">
      <Input type="number" min={1} max={43200} value={Number(config.minutos ?? 60)} onChange={(e) => set({ minutos: Number(e.target.value) })} />
    </Campo>
  );
}

// ── Disparo / destino ─────────────────────────────────────────────

function CamposDisparoWhatsapp({ config, set }: CamposProps) {
  const campanhas = useListaFetch<{ id: string; nome: string; status: string }>("/api/dispatch/campaigns");
  return (
    <>
      <Campo label="Campanha de disparo">
        <Select value={String(config.campaignId || "")} onValueChange={(v) => set({ campaignId: v })}>
          <SelectTrigger><SelectValue placeholder="Selecione uma campanha" /></SelectTrigger>
          <SelectContent>
            {campanhas.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome} ({c.status})</SelectItem>)}
          </SelectContent>
        </Select>
      </Campo>
      <p className="text-xs text-muted-foreground">
        Este nó só inscreve os leads na campanha — a mensagem em si (texto livre ou parâmetros de template) é editada
        lá, em <strong className="text-foreground">/disparo</strong>. A sintaxe de lá é sem o prefixo &quot;lead.&quot;:{" "}
        <code className="rounded bg-secondary px-1">{"{{campo}}"}</code> direto (ex.: <code className="rounded bg-secondary px-1">{"{{nome}}"}</code>).
        Todos os campos que o lead tem NESTE ponto do fluxo ficam disponíveis lá — inclusive os de enriquecimento
        (<code className="rounded bg-secondary px-1">{"{{enriquecimento_empresa}}"}</code>…), se esse nó vier depois
        de um nó de enriquecimento.
      </p>
    </>
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
      <Campo label="Ou cole o ID/URL da planilha">
        <Input value={sheetId} onChange={(e) => set({ sheetId: e.target.value })} placeholder="https://docs.google.com/spreadsheets/d/…" />
      </Campo>
      <Campo label="Aba">
        <Select value={String(config.aba || "")} onValueChange={(v) => set({ aba: v })}>
          <SelectTrigger><SelectValue placeholder="Selecione a aba" /></SelectTrigger>
          <SelectContent>
            {abas.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
      </Campo>
      <Campo label="Ou digite o nome da aba">
        <Input value={String(config.aba || "")} onChange={(e) => set({ aba: e.target.value })} />
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
      <p className="text-xs text-muted-foreground">
        Exporta todos os campos presentes nos leads — inclusive os de enriquecimento, quando esse nó vier depois de um nó de enriquecimento.
      </p>
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
    case "gatilho_manual": return <CamposGatilhoManual config={config} set={set} />;
    case "extracao_cnpj": return <CamposExtracaoCnpj config={config} set={set} />;
    case "extracao_maps": return <CamposExtracaoMaps config={config} set={set} />;
    case "extracao_instagram": return <CamposExtracaoInstagram config={config} set={set} />;
    case "extracao_linkedin": return <CamposExtracaoLinkedin config={config} set={set} />;
    case "fonte_historico": return <CamposFonteHistorico config={config} set={set} />;
    case "enriquecimento_ia": return <CamposEnriquecimentoIa config={config} set={set} />;
    case "enriquecimento_maps": return <CamposEnriquecimentoMaps config={config} set={set} />;
    case "filtro_leads": return <CamposFiltroLeads config={config} set={set} />;
    case "espera": return <CamposEspera config={config} set={set} />;
    case "disparo_whatsapp": return <CamposDisparoWhatsapp config={config} set={set} />;
    case "disparo_email": return <p className="text-sm text-muted-foreground">Disparo por e-mail ainda não está disponível.</p>;
    case "destino_sheets": return <CamposDestinoSheets config={config} set={set} />;
    default: return null;
  }
}

export function FlowNodeConfigPanel({
  node, variaveisFlow, onChange, onClose, onDelete,
}: {
  node: FlowNode;
  variaveisFlow: VariavelEntrada[];
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

      {meta.categoria !== "gatilho" && <VariaveisDisponiveis variaveisFlow={variaveisFlow} />}

      <div className="flex flex-col gap-4">
        <CamposDoNo node={node} config={config} set={set} />
      </div>

      <Button variant="outline" size="sm" onClick={onDelete} className="mt-auto text-destructive hover:border-destructive">
        <Trash2 className="h-3.5 w-3.5" /> Remover nó
      </Button>
    </div>
  );
}
