"use client";

import { useState } from "react";
import type { OnboardingStatus } from "@/lib/onboarding/db";
import type { ResultadoOnboarding } from "@/lib/onboarding/ia";
import type { AplicacaoRow } from "@/lib/onboarding/aplicar";
import type { RespostasOnboarding } from "@/lib/onboarding/questionario";
import { QuestionarioWizard } from "./questionario-wizard";
import { GerandoPlanos } from "./gerando-planos";
import { PlanosView, type MetaCenario } from "./planos-view";

type Tela = "questionario" | "gerando" | "planos";

export function OnboardingShell({
  status, respostas, resultado, erro, aplicacoes, metaCenarios,
}: {
  status: OnboardingStatus;
  respostas: RespostasOnboarding;
  resultado: ResultadoOnboarding | null;
  erro: string | null;
  aplicacoes: AplicacaoRow[];
  metaCenarios: Record<string, MetaCenario>;
}) {
  const inicial: Tela = status === "gerando" || status === "erro" ? "gerando" : status === "pronto" && resultado ? "planos" : "questionario";
  const [tela, setTela] = useState<Tela>(inicial);
  // A tela guarda "gerando" em estado local: quando o worker termina e a
  // página recarrega os dados (router.refresh), o estado não mudava sozinho
  // e a tela ficava carregando até um F5. Troca de tela quando o status ou a
  // geração mudam (ajuste de estado na renderização, sem efeito).
  const chave = `${status}|${resultado?.geradoEm ?? ""}`;
  const [chaveAntes, setChaveAntes] = useState(chave);
  if (chave !== chaveAntes) {
    setChaveAntes(chave);
    if (status === "pronto" && resultado) setTela("planos");
    else if (status === "gerando" || status === "erro") setTela("gerando");
  }

  if (tela === "gerando") return <GerandoPlanos erroInicial={status === "erro" ? erro : null} onEditar={() => setTela("questionario")} />;
  if (tela === "planos" && resultado) {
    return (
      <PlanosView
        resultado={resultado}
        aplicacoesIniciais={aplicacoes}
        metaCenarios={metaCenarios}
        onEditarRespostas={() => setTela("questionario")}
      />
    );
  }
  return <QuestionarioWizard respostasIniciais={respostas} onGerando={() => setTela("gerando")} />;
}
