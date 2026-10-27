import type { Metadata } from "next";
import Link from "next/link";
import { DocumentoLegal } from "@/components/legal/documento-legal";
import { EMAIL_CONTATO } from "@/components/lp/dados";

export const metadata: Metadata = {
  title: "Termos de Uso · Leadmatic",
  description: "Regras de uso da plataforma Leadmatic.",
};

export default function TermosPage() {
  return (
    <DocumentoLegal titulo="Termos de Uso" atualizadoEm="27 de outubro de 2026">
      <p>
        Estes termos regem o uso do <strong>Leadmatic</strong>, plataforma de prospecção da <strong>Revolução AI</strong>. Ao criar uma conta ou
        usar o serviço, você concorda com eles.
      </p>

      <section>
        <h2>1. O serviço</h2>
        <p>
          O Leadmatic ajuda a encontrar empresas e contatos, enriquecer os dados, organizar listas e funis e fazer abordagens por WhatsApp, e-mail e
          LinkedIn, com automações. Os recursos disponíveis dependem do plano contratado.
        </p>
      </section>

      <section>
        <h2>2. Conta</h2>
        <ul>
          <li>Você deve informar dados verdadeiros e manter a sua senha em segurança.</li>
          <li>A conta é de uso da sua empresa; você responde pelo que for feito com ela.</li>
        </ul>
      </section>

      <section>
        <h2>3. Planos, créditos e pagamento</h2>
        <ul>
          <li>A assinatura é cobrada de forma recorrente, no ciclo escolhido (mensal ou anual), até ser cancelada.</li>
          <li>As buscas e enriquecimentos consomem créditos, conforme a tabela exibida na plataforma. Créditos avulsos podem ser comprados à parte.</li>
          <li>Sem pagamento, o acesso pode ser suspenso; os seus dados ficam guardados para quando você voltar.</li>
          <li>Você pode cancelar a qualquer momento; o acesso continua até o fim do período já pago.</li>
        </ul>
      </section>

      <section>
        <h2>4. Uso permitido</h2>
        <p>Você se compromete a não usar a plataforma para:</p>
        <ul className="mt-2">
          <li>enviar spam, mensagens enganosas ou conteúdo ilegal;</li>
          <li>descumprir a LGPD, as políticas do WhatsApp, do LinkedIn, do Google ou de provedores de e-mail;</li>
          <li>revender o acesso ou os dados da plataforma sem autorização;</li>
          <li>tentar burlar limites, a segurança ou o funcionamento do serviço.</li>
        </ul>
        <p className="mt-2">Podemos suspender contas que descumpram estas regras.</p>
      </section>

      <section>
        <h2>5. Integrações de terceiros</h2>
        <p>
          Ao conectar WhatsApp, e-mail, LinkedIn ou Google, você também segue os termos desses serviços. Bloqueios, limites ou mudanças feitos por
          eles não dependem do Leadmatic.
        </p>
      </section>

      <section>
        <h2>6. Dados</h2>
        <p>
          O tratamento de dados pessoais segue a nossa <Link href="/privacidade" className="text-primary hover:underline">Política de Privacidade</Link>.
          Você é responsável pela forma como usa os dados dos contatos prospectados.
        </p>
      </section>

      <section>
        <h2>7. Responsabilidade</h2>
        <p>
          Trabalhamos para manter o serviço disponível e os dados corretos, mas não garantimos resultados comerciais específicos nem a ausência total
          de falhas. Nossa responsabilidade se limita ao valor pago nos últimos 3 meses.
        </p>
      </section>

      <section>
        <h2>8. Alterações e contato</h2>
        <p>
          Podemos atualizar estes termos, avisando com antecedência quando a mudança for relevante. Dúvidas:{" "}
          <a href={`mailto:${EMAIL_CONTATO}`} className="text-primary hover:underline">{EMAIL_CONTATO}</a>. Fica eleito o foro da comarca de Belo
          Horizonte/MG.
        </p>
      </section>
    </DocumentoLegal>
  );
}
