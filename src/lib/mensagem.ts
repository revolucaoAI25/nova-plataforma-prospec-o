// Renderização das mensagens de disparo (WhatsApp, e-mail, LinkedIn) a
// partir do snapshot do lead. Regras:
//
// - {{campo}} vira o valor do lead; {{campo|padrão}} usa o padrão quando o
//   campo vem vazio ("Oi, {{primeiro_nome|tudo bem}}?").
// - Campo inexistente/vazio sem padrão vira texto vazio e a pontuação em
//   volta é arrumada — nunca sai "{{socio}}" literal pro lead (antes saía,
//   e no LinkedIn nenhuma variável era substituída).
// - Variáveis derivadas, calculadas na hora: {{empresa}} (nome sem LTDA/ME
//   e sem caixa alta), {{primeiro_nome}} (do sócio ou da pessoa), {{cidade}}
//   (município em caixa normal). Base de CNPJ vem toda em MAIÚSCULAS, e
//   "Vi que a CLINICA SORRISO LTDA…" denuncia automação na hora.

const SUFIXOS_JURIDICOS = /[\s,.-]+(ltda\.?|ltd\.?|me|epp|eireli|s\/?a\.?|s\.a\.?|ss|slu|sociedade unipessoal|microempresa|- me|-me)$/i;
const PREPOSICOES = new Set(["de", "da", "do", "das", "dos", "e", "em", "a", "o", "para", "com"]);
// Siglas de negócio que ficam em maiúsculas. Lista fechada: "PAO", "SAO",
// "SP" e afins também são curtos e não podem virar sigla por engano.
const SIGLAS = new Set(["TI", "RH", "CRM", "ERP", "SEO", "EPI", "TV", "LED", "GNV", "CFC", "BR", "PET", "3D", "VIP", "MKT", "B2B", "SAAS"]);

// A base pública de CNPJ vem sem acento. Palavras e nomes mais comuns em
// razão social, município e nome de sócio — o resto fica como veio.
const ACENTOS: Record<string, string> = {
  sao: "São", joao: "João", jose: "José", antonio: "Antônio", sebastiao: "Sebastião", luis: "Luís", luiz: "Luiz",
  conceicao: "Conceição", assuncao: "Assunção", marcia: "Márcia", patricia: "Patrícia", fabio: "Fábio", flavio: "Flávio",
  claudio: "Cláudio", julio: "Júlio", cesar: "César", vinicius: "Vinícius", monica: "Mônica", vania: "Vânia",
  angela: "Ângela", lucia: "Lúcia", sergio: "Sérgio", rogerio: "Rogério", marcio: "Márcio", valeria: "Valéria",
  natalia: "Natália", leticia: "Letícia", vitoria: "Vitória", andre: "André", helio: "Hélio", otavio: "Otávio",
  simoes: "Simões", goncalves: "Gonçalves", araujo: "Araújo", magalhaes: "Magalhães", guimaraes: "Guimarães", brandao: "Brandão",
  clinica: "Clínica", odontologica: "Odontológica", medica: "Médica", estetica: "Estética", saude: "Saúde",
  comercio: "Comércio", servicos: "Serviços", construcao: "Construção", informatica: "Informática", eletrica: "Elétrica",
  mecanica: "Mecânica", distribuicao: "Distribuição", industria: "Indústria", logistica: "Logística", farmacia: "Farmácia",
  otica: "Ótica", grafica: "Gráfica", contabil: "Contábil", contabeis: "Contábeis", acessorios: "Acessórios",
  veiculos: "Veículos", imoveis: "Imóveis", alimenticios: "Alimentícios", pao: "Pão", agropecuaria: "Agropecuária",
  ribeirao: "Ribeirão", belem: "Belém", goiania: "Goiânia", brasilia: "Brasília", florianopolis: "Florianópolis",
  maringa: "Maringá", uberlandia: "Uberlândia", niteroi: "Niterói", jundiai: "Jundiaí", taubate: "Taubaté",
  guaruja: "Guarujá", parana: "Paraná", ceara: "Ceará", goias: "Goiás", maranhao: "Maranhão", piaui: "Piauí",
  amapa: "Amapá", rondonia: "Rondônia", paraiba: "Paraíba", cuiaba: "Cuiabá", macapa: "Macapá", petropolis: "Petrópolis",
  solucoes: "Soluções", comunicacao: "Comunicação", educacao: "Educação", alimentacao: "Alimentação", negocios: "Negócios",
  administracao: "Administração", associacao: "Associação", instalacoes: "Instalações", manutencao: "Manutenção",
  confeccoes: "Confecções", decoracao: "Decoração", iluminacao: "Iluminação", automacao: "Automação", locacao: "Locação",
  refrigeracao: "Refrigeração", importacao: "Importação", exportacao: "Exportação", participacoes: "Participações",
  representacoes: "Representações", producoes: "Produções", aluminio: "Alumínio", ceramica: "Cerâmica", quimica: "Química",
  veterinaria: "Veterinária", nutricao: "Nutrição", laboratorio: "Laboratório", escritorio: "Escritório",
  consultorio: "Consultório", deposito: "Depósito", armazem: "Armazém", acougue: "Açougue", cafe: "Café", salao: "Salão",
  estudio: "Estúdio", eletronicos: "Eletrônicos", eletronica: "Eletrônica", maquinas: "Máquinas", metalurgica: "Metalúrgica",
  plasticos: "Plásticos", tecnico: "Técnico", tecnica: "Técnica", juridica: "Jurídica", juridico: "Jurídico",
};

/** "CLINICA ODONTOLOGICA SORRISO" → "Clinica Odontologica Sorriso" (mantém siglas curtas tipo "TI", "RH"). */
export function capitalizar(texto: string): string {
  const original = texto.trim().replace(/\s+/g, " ");
  if (!original) return "";
  // Já está em caixa mista: respeita como o próprio negócio escreve.
  if (original !== original.toUpperCase() && original !== original.toLowerCase()) return original;
  return original
    .toLowerCase()
    .split(" ")
    .map((p, i) => {
      if (i > 0 && PREPOSICOES.has(p)) return p;
      if (SIGLAS.has(p.toUpperCase())) return p.toUpperCase();
      if (ACENTOS[p]) return ACENTOS[p];
      return p.charAt(0).toUpperCase() + p.slice(1);
    })
    .join(" ");
}

/** Nome da empresa como uma pessoa escreveria: sem sufixo jurídico, sem caixa alta. */
export function nomeEmpresa(nome: string): string {
  let n = nome.trim();
  for (let i = 0; i < 3 && SUFIXOS_JURIDICOS.test(n); i++) n = n.replace(SUFIXOS_JURIDICOS, "").trim();
  return capitalizar(n);
}

export function primeiroNome(nomeCompleto: string): string {
  const primeiro = nomeCompleto.trim().split(/\s+/)[0] ?? "";
  if (primeiro.length < 2) return "";
  return capitalizar(primeiro);
}

const texto = (v: unknown) => (v === null || v === undefined ? "" : String(v).trim());

/** Campos calculados a partir do lead — não sobrescrevem um campo de mesmo nome que já exista no lead. */
export function variaveisDerivadas(lead: Record<string, unknown>): Record<string, string> {
  const socio = texto(lead.bigdatacorp_socio_nome) || texto(lead.socio_principal);
  // Pessoa: LinkedIn/Instagram trazem o nome da pessoa em `nome`/`nome_completo`;
  // em CNPJ/Maps `nome` é a empresa, então só o sócio vira primeiro nome.
  const pessoa = texto(lead.nome_completo) || (lead.linkedin_url || lead.username ? texto(lead.nome) : "") || socio;
  const empresaBruta = texto(lead.empresa_atual) || texto(lead.bigdatacorp_razao_social) || (lead.linkedin_url ? "" : texto(lead.nome));
  return {
    empresa: empresaBruta ? nomeEmpresa(empresaBruta) : "",
    primeiro_nome: pessoa ? primeiroNome(pessoa) : "",
    cidade: capitalizar(texto(lead.municipio) || texto(lead.cidade_busca)),
  };
}

const TOKEN = /\{\{\s*([a-zA-Z0-9_]+)\s*(?:\|([^}]*))?\}\}/g;

/** Arruma o que sobra quando uma variável some: ", ," → ",", "Oi ,"→"Oi,", espaços duplos. */
function arrumarPontuacao(s: string): string {
  return s
    .replace(/[ \t]+([,.!?;:])/g, "$1")
    .replace(/([,;:])\s*([,.!?;:])/g, "$2")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/^[ \t]*[,;:][ \t]*/gm, "")
    .replace(/\(\s*\)/g, "")
    .trim();
}

export function renderizarMensagem(modelo: string, lead: Record<string, unknown> | null | undefined): string {
  if (!modelo) return "";
  const dados = lead || {};
  const derivadas = variaveisDerivadas(dados);
  const saida = modelo.replace(TOKEN, (_m, campo: string, padrao?: string) => {
    const valor = texto(dados[campo]) || texto(derivadas[campo as keyof typeof derivadas]);
    return valor || (padrao ?? "").trim();
  });
  return arrumarPontuacao(saida);
}

/** Variáveis derivadas disponíveis em qualquer mensagem (lista pra UI e pro revisor de copy). */
export const VARIAVEIS_DERIVADAS = ["empresa", "primeiro_nome", "cidade"] as const;
