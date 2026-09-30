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
