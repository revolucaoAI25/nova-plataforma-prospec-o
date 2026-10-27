"use client";

/**
 * Seletor de planilhas do próprio Google (Google Picker). Com o escopo
 * drive.file, a plataforma só lê e escreve nos arquivos que a pessoa escolhe
 * aqui (ou que ela cria pela plataforma); a escolha fica valendo de vez.
 */

export interface PlanilhaEscolhida {
  id: string;
  name: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    gapi?: any;
    google?: any;
  }
}

let carregando: Promise<void> | null = null;

function carregarPicker(): Promise<void> {
  if (window.google?.picker) return Promise.resolve();
  if (carregando) return carregando;
  carregando = new Promise<void>((resolve, reject) => {
    const falhou = () => {
      carregando = null;
      reject(new Error("Não foi possível abrir o seletor do Google. Confira a conexão e tente de novo."));
    };
    const iniciar = () => window.gapi.load("picker", { callback: () => resolve(), onerror: falhou });
    if (window.gapi?.load) return iniciar();
    const script = document.createElement("script");
    script.src = "https://apis.google.com/js/api.js";
    script.async = true;
    script.onload = iniciar;
    script.onerror = falhou;
    document.head.appendChild(script);
  });
  return carregando;
}

/**
 * Abre o seletor e devolve a planilha escolhida (null se a pessoa fechar).
 * `arquivoId`: abre já mostrando essa planilha, para liberar o acesso a uma
 * planilha que foi configurada antes da troca para o seletor.
 */
export async function escolherPlanilhaNoGoogle(opcoes: { arquivoId?: string } = {}): Promise<PlanilhaEscolhida | null> {
  const resp = await fetch("/api/integrations/google-sheets/seletor", { cache: "no-store" }).catch(() => null);
  const dados = await resp?.json().catch(() => null);
  if (!resp?.ok) throw new Error(dados?.error ?? "Não foi possível abrir o seletor do Google.");
  await carregarPicker();

  const g = window.google.picker;
  return new Promise((resolve) => {
    // Só planilhas (sem pastas nem formulários), em lista, com a busca do Google no topo.
    const visao = new g.DocsView(g.ViewId.SPREADSHEETS).setMode(g.DocsViewMode.LIST).setIncludeFolders(false).setSelectFolderEnabled(false);
    if (opcoes.arquivoId) visao.setFileIds(opcoes.arquivoId);
    // Cabe na tela (inclusive notebook pequeno e celular); o CSS em globals.css centraliza.
    const largura = Math.max(320, Math.min(860, window.innerWidth - 32));
    const altura = Math.max(360, Math.min(560, window.innerHeight - 48));
    const seletor = new g.PickerBuilder()
      .addView(visao)
      .enableFeature(g.Feature.NAV_HIDDEN)
      .enableFeature(g.Feature.SUPPORT_DRIVES)
      .setSize(largura, altura)
      .setOAuthToken(dados.accessToken)
      .setDeveloperKey(dados.apiKey)
      .setAppId(dados.appId)
      .setLocale("pt-BR")
      .setTitle("Escolha a planilha")
      .setCallback((r: any) => {
        const acao = r[g.Response.ACTION];
        if (acao === g.Action.PICKED) {
          const doc = r[g.Response.DOCUMENTS]?.[0];
          resolve(doc ? { id: doc[g.Document.ID], name: doc[g.Document.NAME] } : null);
        } else if (acao === g.Action.CANCEL) {
          resolve(null);
        }
      })
      .build();
    seletor.setVisible(true);
  });
}

/** Cria uma planilha no Drive da pessoa (já liberada para a plataforma). */
export async function criarPlanilhaNova(titulo: string): Promise<PlanilhaEscolhida & { abas: string[] }> {
  const resp = await fetch("/api/integrations/google-sheets/spreadsheets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ titulo }),
  }).catch(() => null);
  const dados = await resp?.json().catch(() => null);
  if (!resp?.ok) throw new Error(dados?.error ?? "Não foi possível criar a planilha.");
  return dados;
}

/** Aceita URL completa ("…/spreadsheets/d/ID/edit") ou o ID direto. */
export function extrairIdPlanilha(entrada: string): string {
  const texto = entrada.trim();
  return texto.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)?.[1] ?? texto;
}
