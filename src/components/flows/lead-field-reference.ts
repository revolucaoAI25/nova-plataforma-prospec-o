/**
 * Cheat-sheet de campos comuns que um lead pode ter dentro de `contexto.lote`
 * — usado só pra referência na UI (clique-pra-copiar `{{lead.campo}}` no
 * painel de configuração do nó). Não é uma lista exaustiva nem garantida:
 * o campo só existe de fato se o nó que produziu o lote (extração,
 * histórico, enriquecimento) o preencheu — por isso agrupado por origem,
 * pra deixar claro que "cargo" só faz sentido depois de um LinkedIn ou de
 * um enriquecimento, por exemplo.
 */
export interface CampoReferencia {
  chave: string;
  label: string;
}

export const LEAD_FIELD_GROUPS: { grupo: string; campos: CampoReferencia[] }[] = [
  {
    grupo: "Dados básicos (qualquer origem)",
    campos: [
      { chave: "nome", label: "Nome" },
      { chave: "telefone", label: "Telefone" },
      { chave: "email", label: "E-mail" },
      { chave: "municipio", label: "Município" },
      { chave: "uf", label: "UF" },
      { chave: "site", label: "Site" },
    ],
  },
  {
    grupo: "CNPJ / Google Maps",
    campos: [
      { chave: "cnpj", label: "CNPJ" },
      { chave: "endereco", label: "Endereço" },
      { chave: "avaliacao", label: "Avaliação (Maps)" },
      { chave: "socio_principal", label: "Sócio principal" },
      { chave: "porte", label: "Porte" },
    ],
  },
  {
    grupo: "LinkedIn",
    campos: [
      { chave: "cargo", label: "Cargo" },
      { chave: "empresa_atual", label: "Empresa atual" },
      { chave: "senioridade", label: "Senioridade" },
      { chave: "linkedin_url", label: "URL do LinkedIn" },
    ],
  },
  {
    grupo: "Enriquecimento (após um nó de enriquecimento via IA)",
    campos: [
      { chave: "enriquecimento_status", label: "Status" },
      { chave: "enriquecimento_empresa", label: "Empresa" },
      { chave: "enriquecimento_cargo", label: "Cargo" },
      { chave: "enriquecimento_cnpj", label: "CNPJ" },
      { chave: "enriquecimento_website", label: "Site" },
      { chave: "enriquecimento_resumo", label: "Resumo" },
    ],
  },
];
