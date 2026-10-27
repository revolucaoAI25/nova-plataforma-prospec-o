"use client";

import { useEffect, useState } from "react";
import { X, Trash2, Plus, Copy, Check, AlertTriangle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Collapsible } from "@/components/ui/collapsible";
import { CidadesVizinhas } from "@/components/search/cidades-vizinhas";
import { RaioEndereco } from "@/components/search/raio-endereco";
import { MultiSelect, type MultiSelectOption } from "@/components/search/multi-select";
import { FLOW_NODE_TYPES, FLOW_NODE_TYPES_LIST, FLOW_NODE_CATEGORIAS, FILTRO_OPERADORES, type SaidaDoNo, type VariavelEntrada } from "@/lib/flow/node-types";
import { cn } from "@/lib/utils";
import { CNAES } from "@/lib/data/cnaes";
import { ESTADOS } from "@/lib/data/estados";
import { NOMES_NICHOS } from "@/lib/data/nichos";
import { LINKEDIN_INDUSTRIES } from "@/lib/data/linkedin-industries";
import { camposDisponiveis, CAMPOS_SEMPRE } from "./lead-field-reference";
import { DESTINOS_TELEFONE } from "@/lib/phone";
import type { FlowNode, FlowNodeTipo } from "@/lib/database.types";
import { CampoPlanilha } from "@/components/sheets/campo-planilha";
import { ResumoCampanha } from "./resumo-campanha";

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
  igual_ao_campo: "é igual ao campo",
  diferente_do_campo: "é diferente do campo",
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

function TokenChip({ token, titulo }: { token: string; titulo?: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <button
      type="button"
      title={titulo ? `${titulo} (clique para copiar)` : "Clique para copiar"}
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
 * Duas coisas diferentes que antes apareciam misturadas:
 * - Campos do lead para a MENSAGEM da campanha (`{{primeiro_nome}}`…),
 *   mostrados nos módulos de disparo conforme o que veio antes no fluxo.
 * - Parâmetros do FLUXO (`{{variaveis.x}}`), declarados no gatilho de
 *   execução manual e digitados em campos de texto dos módulos.
 */
function CamposDaMensagem({ tipos, viaRamo, naRequisicao = false }: { tipos: FlowNodeTipo[]; viaRamo: boolean; naRequisicao?: boolean }) {
  const { grupos, dePlanilha } = camposDisponiveis(tipos, viaRamo);
  return (
    <Collapsible
      className="rounded-lg border border-dashed border-border bg-secondary/20 p-2.5"
      trigger={<span className="text-xs font-semibold text-foreground">{naRequisicao ? "Campos do lead para usar aqui" : "Campos para usar na mensagem"}</span>}
    >
      <div className="flex flex-col gap-2.5 pt-2.5">
        {naRequisicao ? (
          <p className="text-[11px] leading-snug text-muted-foreground">
            Use na URL, nos cabeçalhos e no corpo. Cada chamada leva os dados do próprio lead. Com barra, vira um texto padrão
            quando o campo vier vazio: <code className="rounded bg-secondary px-1">{"{{email|sem e-mail}}"}</code>.
          </p>
        ) : (
          <p className="text-[11px] leading-snug text-muted-foreground">
            Escreva estes campos no texto das etapas da campanha (não aqui). Cada lead recebe com os próprios dados. Com
            barra, vira um texto padrão quando o campo vier vazio: <code className="rounded bg-secondary px-1">{"Oi {{primeiro_nome|tudo bem}}"}</code>.
          </p>
        )}
        {grupos.map((g) => (
          <div key={g.grupo} className="flex flex-col gap-1.5">
            <p className="text-[11px] font-medium text-muted-foreground">{g.grupo}</p>
            <div className="flex flex-wrap gap-1.5">
              {g.campos.map((c) => <TokenChip key={c.chave} token={`{{${c.chave}}}`} titulo={c.label} />)}
            </div>
          </div>
        ))}
        {dePlanilha && (
          <p className="text-[11px] text-muted-foreground">Da planilha: cada coluna vira um campo com o nome do cabeçalho.</p>
        )}
      </div>
    </Collapsible>
  );
}

function ParametrosDoFluxo({ variaveisFlow }: { variaveisFlow: VariavelEntrada[] }) {
  const declaradas = variaveisFlow.filter((v) => v.chave);
  return (
    <Collapsible
      className="rounded-lg border border-dashed border-border bg-secondary/20 p-2.5"
      trigger={<span className="text-xs font-semibold text-foreground">Parâmetros do fluxo</span>}
    >
      <div className="flex flex-col gap-2 pt-2.5">
        {declaradas.length ? (
          <>
            <p className="text-[11px] leading-snug text-muted-foreground">
              Digite um destes em qualquer campo de texto deste módulo (ex.: a cidade da busca). O valor é perguntado a cada
              &quot;Executar agora&quot;.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {declaradas.map((v) => <TokenChip key={v.chave} token={`{{variaveis.${v.chave}}}`} titulo={v.label || v.chave} />)}
            </div>
          </>
        ) : (
          <p className="text-[11px] leading-snug text-muted-foreground">
            Quer usar o mesmo fluxo com valores diferentes a cada vez (outra cidade, outro nicho)? Use o gatilho
            &quot;Execução manual&quot; e crie parâmetros nele. Eles aparecem aqui para você colar nos campos.
          </p>
        )}
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
      <CampoPlanilha
        idPrefixo="gatilho-planilha"
        rotuloAba="Aba monitorada"
        valor={{ sheetId: String(config.sheetId || ""), aba: String(config.abaNome || "") }}
        onChange={(v) => set({ sheetId: v.sheetId, abaNome: v.aba })}
      />
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
        Parâmetros deixam o mesmo fluxo servir para casos diferentes. Ex.: crie <code className="rounded bg-secondary px-1">cidade</code>{" "}
        com padrão &quot;Santo André&quot; e escreva <code className="rounded bg-secondary px-1">{"{{variaveis.cidade}}"}</code> no campo de
        cidade da busca. A cada &quot;Executar agora&quot; a plataforma pergunta o valor.
      </p>
      {variaveis.map((v, i) => (
        <div key={i} className="flex flex-col gap-2 rounded-lg border border-border bg-secondary/30 p-2.5">
          <div className="flex items-center gap-2">
            <Input
              value={v.chave}
              onChange={(e) => atualizar(i, { chave: e.target.value.replace(/[^a-zA-Z0-9_]/g, "") })}
              placeholder="chave (ex: cidade)"
            />
            <Button aria-label="Remover parâmetro" title="Remover parâmetro" type="button" variant="ghost" size="icon" onClick={() => remover(i)}><X className="h-3.5 w-3.5" /></Button>
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
      <CidadesVizinhas
        municipios={municipio}
        ufs={uf}
        km={Number(config.raioVizinhosKm ?? 0)}
        onKmChange={(km) => set({ raioVizinhosKm: km })}
        idPrefixo={`vizinhas-fluxo`}
      />
      <ListaField
        label="Bairros (opcional, separados por vírgula)"
        valor={Array.isArray(config.bairro) ? (config.bairro as string[]) : []}
        onChange={(v) => set({ bairro: v })}
        placeholder="Centro, Vila Assunção"
      />
      <ListaField
        label="CEPs (opcional, separados por vírgula)"
        valor={Array.isArray(config.cep) ? (config.cep as string[]) : []}
        onChange={(v) => set({ cep: v })}
        placeholder="09015-000"
      />

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

      <Campo label="Abertas nos últimos (dias)">
        <Input
          type="number" min={1} placeholder="Ex.: 30 — vale a cada execução"
          value={(config.aberturaUltimosDias as number) ?? ""}
          onChange={(e) => set({ aberturaUltimosDias: e.target.value ? Number(e.target.value) : null })}
        />
      </Campo>
      <div className="grid grid-cols-2 gap-2">
        <Campo label="Abertura — de">
          <Input type="date" disabled={Boolean(config.aberturaUltimosDias)} value={String(config.dataAberturaInicio || "")} onChange={(e) => set({ dataAberturaInicio: e.target.value })} />
        </Campo>
        <Campo label="Abertura — até">
          <Input type="date" disabled={Boolean(config.aberturaUltimosDias)} value={String(config.dataAberturaFim || "")} onChange={(e) => set({ dataAberturaFim: e.target.value })} />
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
  // Modo raio = há algo em raioEndereco (um espaço marca "raio escolhido, endereço ainda vazio").
  const porRaio = String(config.raioEndereco || "").length > 0;
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

      <CampoRadio
        label="Onde buscar"
        value={porRaio ? "raio" : "cidade"}
        onChange={(v) => set(v === "raio" ? { raioEndereco: String(config.raioEndereco || "") || " " } : { raioEndereco: "", raioLat: null, raioLng: null })}
        opcoes={[["cidade", "Cidade ou estado"], ["raio", "Raio de um endereço"]]}
      />
      {porRaio ? (
        <RaioEndereco
          idPrefixo="raio-fluxo"
          endereco={String(config.raioEndereco || "").trimStart()}
          km={Number(config.raioKm ?? 5)}
          ponto={typeof config.raioLat === "number" && typeof config.raioLng === "number"
            ? { lat: config.raioLat, lng: config.raioLng, cidade: "", uf: "", rotulo: String(config.raioEndereco || "") }
            : null}
          onChange={({ endereco, km, ponto }) => set({ raioEndereco: endereco || " ", raioKm: km, raioLat: ponto?.lat ?? null, raioLng: ponto?.lng ?? null })}
        />
      ) : (
        <>
          <ListaField label="Cidades (opcional, separadas por vírgula)" valor={cidades} onChange={(v) => set({ cidades: v })} placeholder="São Paulo, Campinas" />
          <Campo label="Estado(s) (UF)">
            <MultiSelect options={UF_OPTIONS} selected={estados} onChange={(v) => set({ estados: v })} placeholder="Buscar estado…" />
          </Campo>
          <p className="text-xs text-muted-foreground">Com cidade(s) preenchida(s), selecione exatamente 1 estado. Sem cidade, pode escolher vários estados (busca ampla).</p>
        </>
      )}

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

function CamposSociosContato({ config, set }: CamposProps) {
  const modo = config.socios === "todos" ? String(config.maxSocios ?? 2) : "administrador";
  return (
    <>
      <Campo label="De quais sócios buscar o celular">
        <Select value={modo} onValueChange={(v) => set(v === "administrador" ? { socios: "administrador" } : { socios: "todos", maxSocios: Number(v) })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="administrador">Só o administrador</SelectItem>
            <SelectItem value="2">Até 2 sócios (um lead por sócio)</SelectItem>
            <SelectItem value="3">Até 3 sócios (um lead por sócio)</SelectItem>
          </SelectContent>
        </Select>
      </Campo>
      <CampoCheckbox checked={config.soWhatsapp !== false} onCheckedChange={(c) => set({ soWhatsapp: c })}>Só celular com WhatsApp</CampoCheckbox>
      <CampoCheckbox checked={config.respeitarBloqueio !== false} onCheckedChange={(c) => set({ respeitarBloqueio: c })}>Respeitar bloqueio de telemarketing</CampoCheckbox>
      <p className="text-xs text-muted-foreground">
        Só funciona em leads com CNPJ. Quando acha, o celular do sócio vira o telefone do lead (o da empresa fica em {"{{telefone_empresa}}"}).
        Cobra a empresa e cada sócio só quando a consulta encontra o cadastro; sócio sem CPF na empresa nem é consultado.
      </p>
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
        <Campo label={String(config.operador || "").endsWith("_campo") ? "Outro campo" : "Valor"}>
          <Input
            value={String(config.valor || "")}
            onChange={(e) => set({ valor: e.target.value })}
            placeholder={String(config.operador || "").endsWith("_campo") ? "contato_que_falhou, telefone…" : undefined}
          />
        </Campo>
      )}
      <p className="text-xs text-muted-foreground">
        Quem atende segue pela saída <strong className="text-foreground">Atende</strong>. Quem não atende sai por{" "}
        <strong className="text-foreground">Não atende</strong> se ela estiver ligada a algum passo; se não estiver, para aqui.
      </p>
    </>
  );
}

function CamposLimitarLote({ config, set }: CamposProps) {
  const modo = String(config.modo || "primeiros");
  return (
    <>
      <Campo label="Máximo de leads que seguem">
        <Input type="number" min={1} max={100000} value={Number(config.maximo ?? 50)} onChange={(e) => set({ maximo: Number(e.target.value) })} />
      </Campo>
      <Campo label="Quais leads seguem">
        <Select value={modo} onValueChange={(v) => set({ modo: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="primeiros">Os primeiros, na ordem em que chegaram</SelectItem>
            <SelectItem value="aleatorio">Sorteados</SelectItem>
            <SelectItem value="ordenar">Os melhores por um campo</SelectItem>
          </SelectContent>
        </Select>
      </Campo>
      {modo === "ordenar" && (
        <>
          <Campo label="Campo">
            <Input value={String(config.campo || "")} onChange={(e) => set({ campo: e.target.value })} placeholder="avaliacao, total_avaliacoes, capital_social…" />
          </Campo>
          <Campo label="Ordem">
            <Select value={String(config.ordem || "desc")} onValueChange={(v) => set({ ordem: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="desc">Maior primeiro</SelectItem>
                <SelectItem value="asc">Menor primeiro</SelectItem>
              </SelectContent>
            </Select>
          </Campo>
        </>
      )}
      <p className="text-xs text-muted-foreground">
        O resto do lote para aqui e não volta: a extração já guardou esses leads no histórico, e com &quot;só leads novos&quot; eles não
        aparecem de novo. Para dosar o disparo sem perder ninguém, prefira o limite da própria extração ou o limite de novos por dia da
        campanha (a campanha guarda a fila e envia aos poucos). Use este módulo para ficar só com os melhores de um lote grande.
      </p>
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
      <Campo label="Enviar para">
        <Select value={String(config.telefoneDestino || "padrao")} onValueChange={(v) => set({ telefoneDestino: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {DESTINOS_TELEFONE.map((d) => <SelectItem key={d.id} value={d.id}>{d.rotulo}</SelectItem>)}
          </SelectContent>
        </Select>
      </Campo>
      {config.telefoneDestino && config.telefoneDestino !== "padrao" && (
        <p className="text-xs text-muted-foreground">Quem não tiver esse telefone não é inscrito e sai por &quot;Falhou&quot;, se estiver ligada.</p>
      )}
      <p className="text-xs text-muted-foreground">
        Este módulo inscreve os leads na campanha. Logo abaixo aparecem as mensagens dela, o status e de onde vem cada variável.
      </p>
    </>
  );
}

function CamposDisparoLinkedin({ config, set }: CamposProps) {
  const campanhas = useListaFetch<{ id: string; nome: string; status: string }>("/api/linkedin-dispatch/campaigns");
  const contas = useListaFetch<{ id: string; nome: string }>("/api/linkedin-dispatch/accounts");
  return (
    <>
      <Campo label="Campanha de disparo por LinkedIn">
        <Select value={String(config.campaignId || "")} onValueChange={(v) => set({ campaignId: v })}>
          <SelectTrigger><SelectValue placeholder="Selecione uma campanha" /></SelectTrigger>
          <SelectContent>
            {campanhas.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome} ({c.status})</SelectItem>)}
          </SelectContent>
        </Select>
      </Campo>
      <Campo label="Conta LinkedIn">
        <Select value={String(config.accountId || "")} onValueChange={(v) => set({ accountId: v })}>
          <SelectTrigger><SelectValue placeholder="Selecione uma conta" /></SelectTrigger>
          <SelectContent>
            {contas.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
          </SelectContent>
        </Select>
      </Campo>
      <p className="text-xs text-muted-foreground">
        Este módulo só inscreve os leads na campanha. A nota do convite e as mensagens ficam na campanha, em{" "}
        <strong className="text-foreground">Disparo LinkedIn</strong>. O lead precisa ter o endereço do perfil (linkedin_url).
      </p>
    </>
  );
}

function CamposDisparoEmail({ config, set }: CamposProps) {
  const campanhas = useListaFetch<{ id: string; nome: string; status: string }>("/api/email-dispatch/campaigns");
  const senders = useListaFetch<{ id: string; nome: string }>("/api/email-dispatch/senders");
  return (
    <>
      <Campo label="Campanha de disparo por e-mail">
        <Select value={String(config.campaignId || "")} onValueChange={(v) => set({ campaignId: v })}>
          <SelectTrigger><SelectValue placeholder="Selecione uma campanha" /></SelectTrigger>
          <SelectContent>
            {campanhas.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome} ({c.status})</SelectItem>)}
          </SelectContent>
        </Select>
      </Campo>
      <Campo label="Remetente">
        <Select value={String(config.senderId || "")} onValueChange={(v) => set({ senderId: v })}>
          <SelectTrigger><SelectValue placeholder="Selecione um remetente" /></SelectTrigger>
          <SelectContent>
            {senders.map((s) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
          </SelectContent>
        </Select>
      </Campo>
      <p className="text-xs text-muted-foreground">
        Este módulo só inscreve os leads na campanha. O assunto e o texto ficam nas etapas da própria campanha, em{" "}
        <strong className="text-foreground">Disparo e-mail</strong>. Veja abaixo os campos que a mensagem pode usar.
      </p>
    </>
  );
}

function CamposDestinoSheets({ config, set }: CamposProps) {
  return (
    <>
      <CampoPlanilha
        idPrefixo="destino-sheets"
        valor={{ sheetId: String(config.sheetId || ""), aba: String(config.aba || "") }}
        onChange={(v) => set({ sheetId: v.sheetId, aba: v.aba })}
      />
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

function CamposDestinoFunil({ config, set }: CamposProps) {
  const funilId = String(config.funilId || "");
  const funis = useListaFetch<{ id: string; nome: string }>("/api/funis");
  const colunas = useListaFetch<{ id: string; nome: string }>(funilId ? `/api/funis/${funilId}` : null);
  return (
    <>
      <Campo label="Funil">
        <Select value={funilId} onValueChange={(v) => set({ funilId: v, colunaId: "" })}>
          <SelectTrigger><SelectValue placeholder="Selecione o funil" /></SelectTrigger>
          <SelectContent>
            {funis.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
          </SelectContent>
        </Select>
      </Campo>
      <Campo label="Coluna">
        <Select value={String(config.colunaId || "")} onValueChange={(v) => set({ colunaId: v })} disabled={!funilId}>
          <SelectTrigger><SelectValue placeholder="Selecione a coluna" /></SelectTrigger>
          <SelectContent>
            {colunas.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
          </SelectContent>
        </Select>
      </Campo>
      <p className="text-xs text-muted-foreground">
        Se a coluna escolhida tiver um fluxo configurado pra disparar quando um card entra nela, esse depósito NÃO
        dispara esse fluxo — só o arraste manual do card na tela do Funil dispara (evita loop entre fluxo e funil).
      </p>
    </>
  );
}

interface CamposProps {
  config: Record<string, unknown>;
  set: (patch: Record<string, unknown>) => void;
}

const TOM_TEXTO: Record<SaidaDoNo["tom"], string> = {
  sucesso: "text-success",
  erro: "text-destructive",
  info: "text-info",
  neutro: "text-muted-foreground",
};

const TIPOS_PARA_RAMO = FLOW_NODE_TYPES_LIST.filter((t) => t.categoria !== "gatilho" && t.categoria !== "extracao" && t.disponivel);

/** Lista as saídas extras do nó: o que sai por cada uma e onde está ligada (ou um atalho pra ligar). */
function SaidasDoNo({
  tipo, config, set, ligadas, onAdicionar,
}: { tipo: FlowNodeTipo; ligadas: Record<string, string>; onAdicionar: (saida: string, tipo: FlowNodeTipo) => void } & CamposProps) {
  const meta = FLOW_NODE_TYPES[tipo];
  if (!meta.saidas?.length) return null;
  const porResultado = meta.saidas.some((x) => x.quando === "resultado");
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-secondary/30 p-3">
      <div>
        <p className="text-xs font-semibold text-foreground">Saídas</p>
        <p className="text-xs text-muted-foreground">
          {porResultado
            ? `"${meta.rotuloSaidaPrincipal}" segue na hora com quem foi inscrito. As outras soltam os leads conforme a campanha anda, em lotes a cada ~30 min, numa execução própria.`
            : "Cada saída pode levar a um passo diferente. Arraste da bolinha no cartão ou use o atalho abaixo."}
        </p>
      </div>
      {meta.saidas.map((saida) => (
        <div key={saida.id} className="flex flex-col gap-1.5 border-t border-border/60 pt-2.5 first:border-t-0 first:pt-0">
          <p className={cn("text-xs font-semibold", TOM_TEXTO[saida.tom])}>{saida.label}</p>
          <p className="text-[11px] leading-snug text-muted-foreground">{saida.descricao}</p>
          {saida.id === "sem_resposta" && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              Esperar
              <Input
                type="number" min={1} max={720} className="h-7 w-16 px-2 text-xs"
                value={Number(config.horasSemResposta ?? 48)}
                onChange={(e) => set({ horasSemResposta: Number(e.target.value) })}
              />
              horas depois da última mensagem
            </div>
          )}
          {ligadas[saida.id] ? (
            <p className="text-[11px] text-foreground">Ligada a <strong>{ligadas[saida.id]}</strong></p>
          ) : (
            <Select value="" onValueChange={(v) => onAdicionar(saida.id, v as FlowNodeTipo)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Adicionar um passo nesta saída…" /></SelectTrigger>
              <SelectContent>
                {FLOW_NODE_CATEGORIAS.filter((c) => TIPOS_PARA_RAMO.some((t) => t.categoria === c.categoria)).map((c) => (
                  <div key={c.categoria}>
                    <p className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-muted-2">{c.label}</p>
                    {TIPOS_PARA_RAMO.filter((t) => t.categoria === c.categoria).map((t) => (
                      <SelectItem key={t.tipo} value={t.tipo}>{t.label}</SelectItem>
                    ))}
                  </div>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      ))}
    </div>
  );
}

const EXEMPLO_CORPO = `{
  "nome": "{{nome}}",
  "telefone": "{{telefone}}",
  "empresa": "{{empresa}}"
}`;

function CamposRequisicaoHttp({ config, set }: CamposProps) {
  const metodo = String(config.metodo || "POST");
  const modo = String(config.modo || "por_lead");
  const cabecalhos = (Array.isArray(config.cabecalhos) ? config.cabecalhos : []) as { nome: string; valor: string }[];
  const setCab = (lista: { nome: string; valor: string }[]) => set({ cabecalhos: lista });
  const semCorpo = metodo === "GET" || metodo === "DELETE";
  return (
    <>
      <Campo label="URL">
        <Input value={String(config.url || "")} onChange={(e) => set({ url: e.target.value })} placeholder="https://sua-plataforma.com/webhook" />
      </Campo>
      <Campo label="Método">
        <Select value={metodo} onValueChange={(v) => set({ metodo: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {["POST", "PUT", "PATCH", "GET", "DELETE"].map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
      </Campo>
      <Campo label="Como enviar">
        <Select value={modo} onValueChange={(v) => set({ modo: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="por_lead">Uma chamada para cada lead</SelectItem>
            <SelectItem value="lote">Vários leads por chamada</SelectItem>
          </SelectContent>
        </Select>
      </Campo>
      {modo === "lote" && (
        <Campo label="Leads por chamada">
          <Input type="number" min={1} max={1000} value={Number(config.tamanhoLote ?? 100)} onChange={(e) => set({ tamanhoLote: Number(e.target.value) })} />
        </Campo>
      )}
      <Campo label="Cabeçalhos">
        <div className="flex flex-col gap-2">
          {cabecalhos.map((c, i) => (
            <div key={i} className="flex flex-col gap-1.5 rounded-lg border border-border p-2">
              <div className="flex items-center gap-1.5">
                <Input
                  aria-label="Nome do cabeçalho"
                  value={c.nome}
                  onChange={(e) => setCab(cabecalhos.map((x, j) => (j === i ? { ...x, nome: e.target.value } : x)))}
                  placeholder="Nome, ex.: Authorization"
                />
                <Button variant="ghost" size="icon" aria-label="Remover cabeçalho" onClick={() => setCab(cabecalhos.filter((_, j) => j !== i))}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <Input
                aria-label="Valor do cabeçalho"
                value={c.valor}
                onChange={(e) => setCab(cabecalhos.map((x, j) => (j === i ? { ...x, valor: e.target.value } : x)))}
                placeholder="Valor, ex.: Bearer sua-chave"
              />
            </div>
          ))}
          {cabecalhos.length < 20 && (
            <Button variant="outline" size="sm" className="self-start" onClick={() => setCab([...cabecalhos, { nome: "", valor: "" }])}>
              <Plus className="h-3.5 w-3.5" /> Adicionar cabeçalho
            </Button>
          )}
        </div>
      </Campo>
      {!semCorpo && (
        <Campo label="Corpo (opcional)">
          <Textarea
            value={String(config.corpo || "")}
            onChange={(e) => set({ corpo: e.target.value })}
            placeholder={modo === "lote" ? '{ "contatos": {{leads}} }' : EXEMPLO_CORPO}
            rows={6}
            className="font-mono text-xs"
          />
        </Campo>
      )}
      <p className="text-xs text-muted-foreground">
        {semCorpo
          ? "Sem corpo: passe os dados do lead na própria URL, ex. ?telefone={{telefone}}."
          : modo === "lote"
            ? <>Vazio, envia <code className="rounded bg-secondary px-1">{'{"leads": [...]}'}</code> com todos os campos. No seu modelo, <code className="rounded bg-secondary px-1">{"{{leads}}"}</code> vira a lista de leads.</>
            : "Vazio, envia o lead inteiro em JSON. O corpo vai como JSON, a não ser que você troque o Content-Type nos cabeçalhos."}
        {" "}Quem recebe resposta 200 a 299 segue por <strong className="text-foreground">Deu certo</strong>; o resto sai por{" "}
        <strong className="text-foreground">Falhou</strong> se ela estiver ligada. Chaves de acesso dos cabeçalhos ficam salvas no fluxo.
      </p>
    </>
  );
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
    case "enriquecimento_bigdatacorp": return <CamposSociosContato config={config} set={set} />;
    case "filtro_leads": return <CamposFiltroLeads config={config} set={set} />;
    case "limitar_lote": return <CamposLimitarLote config={config} set={set} />;
    case "espera": return <CamposEspera config={config} set={set} />;
    case "disparo_whatsapp": return <CamposDisparoWhatsapp config={config} set={set} />;
    case "disparo_email": return <CamposDisparoEmail config={config} set={set} />;
    case "disparo_linkedin": return <CamposDisparoLinkedin config={config} set={set} />;
    case "destino_sheets": return <CamposDestinoSheets config={config} set={set} />;
    case "destino_funil": return <CamposDestinoFunil config={config} set={set} />;
    case "requisicao_http": return <CamposRequisicaoHttp config={config} set={set} />;
    default: return null;
  }
}

export function FlowNodeConfigPanel({
  node, variaveisFlow, anteriores = { tipos: [], viaRamo: false }, saidasLigadas = {}, onAdicionarNaSaida, onChange, onClose, onDelete,
}: {
  node: FlowNode;
  variaveisFlow: VariavelEntrada[];
  /** Módulos antes deste no fluxo (para saber quais campos o lead tem aqui). */
  anteriores?: { tipos: FlowNodeTipo[]; viaRamo: boolean };
  /** Saída extra → nome do passo ligado a ela. */
  saidasLigadas?: Record<string, string>;
  onAdicionarNaSaida?: (saida: string, tipo: FlowNodeTipo) => void;
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
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fechar"><X className="h-4 w-4" /></Button>
      </div>

      <div className="flex flex-col gap-4">
        <CamposDoNo node={node} config={config} set={set} />
      </div>

      {onAdicionarNaSaida && (
        <SaidasDoNo tipo={node.tipo} config={config} set={set} ligadas={saidasLigadas} onAdicionar={onAdicionarNaSaida} />
      )}

      {/* Referência, não campo: fica recolhida e depois dos campos do nó. */}
      {meta.categoria === "disparo" && typeof config.campaignId === "string" && config.campaignId && (
        <ResumoCampanha
          tipo={node.tipo}
          campaignId={config.campaignId}
          tipos={anteriores.tipos}
          viaRamo={anteriores.viaRamo}
          mapeamento={(config.mapeamentoVariaveis as Record<string, string> | undefined) ?? {}}
          onMapear={(m) => set({ mapeamentoVariaveis: m })}
        />
      )}
      {meta.categoria === "disparo" && <CamposDaMensagem tipos={anteriores.tipos} viaRamo={anteriores.viaRamo} />}
      {node.tipo === "requisicao_http" && <CamposDaMensagem tipos={anteriores.tipos} viaRamo={anteriores.viaRamo} naRequisicao />}
      {meta.categoria !== "gatilho" && meta.categoria !== "disparo" && <ParametrosDoFluxo variaveisFlow={variaveisFlow} />}

      <Button variant="outline" size="sm" onClick={onDelete} className="mt-auto text-destructive hover:border-destructive">
        <Trash2 className="h-3.5 w-3.5" /> Remover nó
      </Button>
    </div>
  );
}
