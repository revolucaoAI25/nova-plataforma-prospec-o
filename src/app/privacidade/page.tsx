import type { Metadata } from "next";
import { DocumentoLegal } from "@/components/legal/documento-legal";
import { EMAIL_CONTATO } from "@/components/lp/dados";

export const metadata: Metadata = {
  title: "Política de Privacidade · Leadmatic",
  description: "Como o Leadmatic coleta, usa e protege os seus dados.",
};

export default function PrivacidadePage() {
  return (
    <DocumentoLegal titulo="Política de Privacidade" atualizadoEm="27 de outubro de 2026">
      <p>
        Esta política explica como o <strong>Leadmatic</strong>, plataforma de prospecção da <strong>Revolução AI</strong>, trata os dados de quem
        usa o serviço. Ao criar uma conta ou usar a plataforma, você concorda com o que está descrito aqui. Seguimos a Lei Geral de Proteção de
        Dados (Lei nº 13.709/2018, LGPD).
      </p>

      <section>
        <h2>1. Dados que coletamos</h2>
        <ul>
          <li><strong>Dados de cadastro:</strong> nome, e-mail, telefone, empresa e, para cobrança, CPF ou CNPJ.</li>
          <li><strong>Dados de uso:</strong> buscas feitas, listas geradas, campanhas, automações e registros de acesso (data, hora e endereço IP).</li>
          <li><strong>Dados de pagamento:</strong> processados pelo nosso parceiro de pagamentos; não guardamos o número do cartão.</li>
          <li><strong>Integrações que você conecta:</strong> contas de WhatsApp, e-mail, LinkedIn e Google, apenas com as permissões que você autorizar.</li>
          <li><strong>Navegação na página de vendas:</strong> cookies e identificadores de campanha para medir os resultados dos nossos anúncios.</li>
        </ul>
      </section>

      <section>
        <h2>2. Como usamos os dados</h2>
        <ul>
          <li>Prestar o serviço: fazer as buscas, montar as listas, enviar as campanhas e executar as automações que você configurar.</li>
          <li>Cobrar a assinatura e os créditos contratados.</li>
          <li>Dar suporte, enviar avisos sobre a conta e comunicações sobre o serviço.</li>
          <li>Melhorar a plataforma e prevenir fraudes e abusos.</li>
        </ul>
        <p className="mt-2">Não vendemos os seus dados.</p>
      </section>

      <section>
        <h2>3. Dados da sua conta Google</h2>
        <p>
          Se você conectar a sua conta Google para usar o Google Sheets, o Leadmatic pede apenas o acesso aos arquivos do Google Drive que você
          escolher no seletor do Google ou que a própria plataforma criar a seu pedido (permissão <em>drive.file</em>). Não temos acesso aos
          demais arquivos do seu Drive.
        </p>
        <ul className="mt-2">
          <li>Usamos esse acesso apenas para gravar os leads nas planilhas que você escolheu e para ler as planilhas que você pediu para monitorar.</li>
          <li>Não usamos os dados do Google para publicidade, não os vendemos e não os compartilhamos com terceiros, exceto quando necessário para prestar o serviço ou exigido por lei.</li>
          <li>Não usamos os dados do Google para treinar modelos de inteligência artificial.</li>
          <li>Você pode desconectar a conta Google a qualquer momento em Conexões, ou remover o acesso em myaccount.google.com/permissions.</li>
        </ul>
        <p className="mt-2">
          O uso e a transferência de informações recebidas das APIs do Google seguem a{" "}
          <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
            Política de Dados do Usuário dos Serviços de API do Google
          </a>
          , incluindo os requisitos de Uso Limitado.
        </p>
      </section>

      <section>
        <h2>4. Dados das empresas e contatos prospectados</h2>
        <p>
          Os dados de empresas e contatos exibidos nas buscas vêm de fontes públicas e de parceiros de dados. Você é responsável por usar essas
          informações e fazer as abordagens de acordo com a LGPD e com as regras de cada canal (WhatsApp, e-mail e LinkedIn), incluindo atender
          pedidos de descadastro.
        </p>
      </section>

      <section>
        <h2>5. Compartilhamento</h2>
        <p>
          Compartilhamos dados apenas com fornecedores que nos ajudam a operar o serviço (hospedagem, banco de dados, pagamentos, envio de e-mails,
          conexão com o WhatsApp e fontes de dados), sempre no limite do necessário, ou quando exigido por lei ou ordem judicial.
        </p>
      </section>

      <section>
        <h2>6. Segurança e armazenamento</h2>
        <p>
          Os dados ficam em provedores de nuvem com acesso restrito e conexão criptografada. Mantemos os dados enquanto a sua conta estiver ativa e
          pelo tempo necessário para cumprir obrigações legais. Depois disso, eles são excluídos ou anonimizados.
        </p>
      </section>

      <section>
        <h2>7. Seus direitos</h2>
        <p>
          Você pode pedir acesso, correção, portabilidade ou exclusão dos seus dados, e revogar consentimentos, escrevendo para{" "}
          <a href={`mailto:${EMAIL_CONTATO}`} className="text-primary hover:underline">{EMAIL_CONTATO}</a>. Respondemos em até 15 dias.
        </p>
      </section>

      <section>
        <h2>8. Alterações</h2>
        <p>Podemos atualizar esta política. Quando a mudança for relevante, avisaremos pela plataforma ou por e-mail.</p>
      </section>
    </DocumentoLegal>
  );
}
