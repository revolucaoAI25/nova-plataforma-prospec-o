import { WebSocket as NodeWebSocket } from "ws";

// O construtor do SupabaseClient sempre inicializa um RealtimeClient
// internamente, mesmo quando o chamador nunca usa .channel()/.realtime —
// e esse RealtimeClient exige um construtor de WebSocket disponível no
// ambiente. Node só tem WebSocket nativo a partir da v22; num runtime
// mais antigo (ex: worker em Node 20 no Railway) isso derruba a criação
// do cliente inteiro com "Node.js detected but native WebSocket not
// found". Importar este módulo por efeito colateral, antes de qualquer
// createClient/createServerClient, resolve isso sem depender da versão
// de Node escolhida pelo ambiente de deploy.
if (typeof globalThis.WebSocket === "undefined") {
  (globalThis as unknown as { WebSocket: unknown }).WebSocket = NodeWebSocket;
}
