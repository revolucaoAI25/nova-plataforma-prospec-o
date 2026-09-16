export interface Nicho {
  query: string;
  subnichos: string[];
}

// Catálogo de nichos/subnichos para a busca Google Maps. Portado de
// modules/nichos.py do produto atual.
export const NICHOS: Record<string, Nicho> = {
  "Advogado / Escritório de Advocacia": {
    query: "escritório de advocacia",
    subnichos: [
      "Trabalhista", "Tributário", "Família e Divórcio", "Criminal / Penal",
      "Imobiliário", "Previdenciário / INSS", "Empresarial / Societário",
      "Cível", "Ambiental", "Direito Digital", "Propriedade Intelectual",
    ],
  },
  "Médico / Clínica Médica": {
    query: "clínica médica",
    subnichos: [
      "Cardiologia", "Ortopedia e Traumatologia", "Dermatologia", "Pediatria",
      "Ginecologia e Obstetrícia", "Psiquiatria", "Neurologia", "Oftalmologia",
      "Urologia", "Oncologia", "Endocrinologia", "Gastroenterologia",
    ],
  },
  "Dentista / Clínica Odontológica": {
    query: "clínica odontológica",
    subnichos: [
      "Ortodontia", "Implantodontia", "Periodontia", "Endodontia",
      "Odontopediatria", "Prótese Dentária", "Harmonização Orofacial",
    ],
  },
  "Psicólogo / Clínica de Psicologia": {
    query: "clínica de psicologia",
    subnichos: [
      "Psicoterapia Individual", "Psicologia Infantil", "Terapia de Casal",
      "Psicologia Organizacional", "Neuropsicologia", "Terapia Cognitivo-Comportamental",
    ],
  },
  "Contador / Escritório Contábil": {
    query: "escritório de contabilidade",
    subnichos: [
      "Contabilidade Empresarial", "Planejamento Tributário", "Auditoria",
      "Departamento Pessoal / RH", "Abertura de Empresas", "Contabilidade para MEI",
    ],
  },
  "Arquiteto / Escritório de Arquitetura": {
    query: "escritório de arquitetura",
    subnichos: [
      "Arquitetura Residencial", "Arquitetura Comercial", "Design de Interiores",
      "Urbanismo e Paisagismo", "Arquitetura Sustentável",
    ],
  },
  "Engenheiro / Escritório de Engenharia": {
    query: "escritório de engenharia",
    subnichos: [
      "Engenharia Civil", "Engenharia Elétrica", "Engenharia Mecânica",
      "Engenharia Ambiental", "Engenharia de Segurança do Trabalho",
    ],
  },
  "Nutricionista / Clínica de Nutrição": {
    query: "clínica de nutrição",
    subnichos: [
      "Nutrição Esportiva", "Nutrição Clínica", "Emagrecimento",
      "Nutrição Infantil", "Nutrição Oncológica",
    ],
  },
  "Fisioterapeuta / Clínica de Fisioterapia": {
    query: "clínica de fisioterapia",
    subnichos: [
      "Fisioterapia Ortopédica", "Fisioterapia Neurológica", "Pilates Clínico",
      "Fisioterapia Esportiva", "RPG / Reeducação Postural",
    ],
  },
  "Corretor / Imobiliária": {
    query: "imobiliária",
    subnichos: [
      "Venda de Imóveis Residenciais", "Venda de Imóveis Comerciais",
      "Aluguel Residencial", "Aluguel Comercial", "Lançamentos / Incorporação",
    ],
  },
  "Escola / Curso": {
    query: "escola",
    subnichos: [
      "Educação Infantil", "Ensino Fundamental", "Ensino Médio",
      "Curso de Idiomas", "Curso Técnico / Profissionalizante",
      "Curso Preparatório / Pré-vestibular",
    ],
  },
  "Outro / Personalizado": { query: "", subnichos: [] },
};

export const NOMES_NICHOS = Object.keys(NICHOS);
