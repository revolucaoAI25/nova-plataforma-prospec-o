import type { FlowNodeTipo } from "@/lib/database.types";
import type { FlowNodeExecutor } from "../executor-types";
import { executarExtracaoCnpj } from "./extracao-cnpj";
import { executarExtracaoMaps } from "./extracao-maps";
import { executarExtracaoInstagram } from "./extracao-instagram";
import { executarExtracaoLinkedin } from "./extracao-linkedin";
import { executarFonteHistorico } from "./fonte-historico";
import { executarEnriquecimentoIa } from "./enriquecimento-ia";
import { executarEnriquecimentoMaps } from "./enriquecimento-maps";
import { executarEnriquecimentoBigDataCorp } from "./enriquecimento-bigdatacorp";
import { executarFiltroLeads } from "./filtro-leads";
import { executarEspera } from "./espera";
import { executarLimitarLote } from "./limitar-lote";
import { executarDisparoWhatsapp } from "./disparo-whatsapp";
import { executarDisparoEmail } from "./disparo-email";
import { executarDisparoLinkedin } from "./disparo-linkedin";
import { executarDestinoSheets } from "./destino-sheets";
import { executarDestinoFunil } from "./destino-funil";

/**
 * Registro de executores por tipo de nó — só os tipos que aparecem DEPOIS
 * do gatilho no grafo. Os nós-gatilho (gatilho_*) não têm executor aqui:
 * são avaliados à parte pelo motor (src/lib/flow/flow-engine.ts), que
 * precisa varrer todos os fluxos ativos a cada tick pra decidir se dispara
 * uma run nova — não só avançar o nó atual de uma run já em andamento.
 */
export const FLOW_NODE_EXECUTORS: Partial<Record<FlowNodeTipo, FlowNodeExecutor>> = {
  extracao_cnpj: executarExtracaoCnpj,
  extracao_maps: executarExtracaoMaps,
  extracao_instagram: executarExtracaoInstagram,
  extracao_linkedin: executarExtracaoLinkedin,
  fonte_historico: executarFonteHistorico,
  enriquecimento_ia: executarEnriquecimentoIa,
  enriquecimento_maps: executarEnriquecimentoMaps,
  enriquecimento_bigdatacorp: executarEnriquecimentoBigDataCorp,
  filtro_leads: executarFiltroLeads,
  limitar_lote: executarLimitarLote,
  espera: executarEspera,
  disparo_whatsapp: executarDisparoWhatsapp,
  disparo_email: executarDisparoEmail,
  disparo_linkedin: executarDisparoLinkedin,
  destino_sheets: executarDestinoSheets,
  destino_funil: executarDestinoFunil,
};
