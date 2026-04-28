import type { Metadata } from 'next'
import { JsonLd } from '@/components/seo/JsonLd'
import { breadcrumb } from '@/lib/seo/jsonLd'

export const metadata: Metadata = {
  title:       'Política de Privacidade',
  description: 'Como o XP-Money trata os teus dados pessoais e financeiros — RGPD/GDPR-compliant. Dados na UE (Supabase eu-central-1), nunca partilhados, apagáveis em 1 clique.',
  alternates:  { canonical: '/privacidade' },
  openGraph:   {
    type:        'article',
    title:       'Política de Privacidade · XP-Money',
    description: 'Tratamento de dados pessoais e financeiros conforme RGPD/GDPR.',
    url:         'https://xp-money.com/privacidade',
  },
  robots:      { index: true, follow: true },
}

/**
 * Política de Privacidade — documento obrigatório ao abrigo do RGPD/GDPR
 * para qualquer serviço que processe dados pessoais de cidadãos UE.
 *
 * IMPORTANTE: este é um TEMPLATE de arranque que cobre os requisitos
 * mínimos do Art. 13º RGPD (identidade do responsável, finalidades, base
 * legal, destinatários, prazo, direitos). **Antes de ir ao ar em produção
 * com clientes pagantes, valida este texto com um advogado** — as
 * empresas portuguesas respondem à CNPD e as multas RGPD são até 4% do
 * volume de negócios global anual.
 */
export default function PrivacidadePage() {
  return (
    <>
      <JsonLd schema={breadcrumb([
        { name: 'Início', href: '/' },
        { name: 'Política de Privacidade', href: '/privacidade' },
      ])} />
      <h1>Política de Privacidade</h1>
      <p className="updated">Última atualização: 17 de abril de 2026</p>

      <div className="tldr">
        <strong>TL;DR:</strong> Tratamos dados pessoais teus (email, nome, dados
        financeiros que TU introduzes) apenas para fazer a app funcionar. Nunca
        os vendemos. Nunca pedimos acesso ao teu banco. Podes apagar tudo num
        clique em Definições. Responderemos a qualquer pedido RGPD em 30 dias.
      </div>

      <h2>1. Quem somos</h2>
      <p>
        O <strong>XP-Money</strong> é um serviço de finanças pessoais gamificadas operado
        pela entidade responsável identificada abaixo (&quot;nós&quot;, &quot;XP-Money&quot;). Esta
        Política explica como recolhemos, usamos e protegemos os teus dados
        pessoais quando utilizas os websites <strong>xp-money.com</strong> ou
        <strong> xp-money.pt</strong> (que redireciona para o principal) ou
        qualquer versão instalada como PWA.
      </p>
      <p>
        <strong>Contacto do Responsável pelo Tratamento:</strong>{' '}
        <a href="/contacto">formulário de contacto</a> (as mensagens são
        entregues diretamente ao responsável sem exposição de email público).
      </p>

      <h2>2. Que dados recolhemos</h2>

      <h3>2.1. Dados que nos dás voluntariamente</h3>
      <ul>
        <li><strong>Conta:</strong> email, nome, foto de perfil (via Clerk, opcional).</li>
        <li><strong>Perfil financeiro:</strong> desafio/objetivo (ex. &quot;poupar €5.000&quot;), moeda preferida.</li>
        <li><strong>Transações:</strong> valor, categoria, descrição, data — que TU introduzes manualmente, por scan de recibo, ou por importação de extrato.</li>
        <li><strong>Objetivos e depósitos:</strong> nome do objetivo, valor-alvo, prazo, depósitos feitos.</li>
        <li><strong>Conteúdo de reports:</strong> se reportas bugs ou envias mensagens via formulário de contacto, ficamos com o conteúdo + email.</li>
      </ul>

      <h3>2.2. Dados gerados pela utilização</h3>
      <ul>
        <li><strong>Dados de gamificação:</strong> XP, nível, missões concluídas, badges, streaks, estado do mascote.</li>
        <li><strong>Score financeiro:</strong> calculado a partir das tuas transações e objetivos.</li>
        <li><strong>Histórico de XP:</strong> registo das ações que geraram pontos (ex. &quot;registou transação&quot;).</li>
        <li><strong>Certificados de cursos:</strong> conclusões e códigos de certificado gerados pela Academia.</li>
      </ul>

      <h3>2.3. Dados técnicos automáticos</h3>
      <ul>
        <li><strong>Analytics (PostHog):</strong> eventos anonimizados para sabermos que funcionalidades usas — sem teu nome nem email.</li>
        <li><strong>Logs de erro:</strong> mensagens de erro + user-agent para corrigir bugs (limpamos após 30 dias).</li>
        <li><strong>Cookies:</strong> ver <a href="/cookies">Política de Cookies</a>.</li>
      </ul>

      <h3>2.4. O que NÃO recolhemos</h3>
      <ul>
        <li>Credenciais do teu banco (user/password). <strong>Nunca pedimos.</strong></li>
        <li>Saldos em contas bancárias via Open Banking/PSD2.</li>
        <li>Localização GPS, dados biométricos, contactos, fotos da galeria fora das que escolhes para scan de recibo.</li>
      </ul>

      <h2>3. Para que usamos os teus dados (finalidades)</h2>
      <ol>
        <li><strong>Fornecer o serviço:</strong> processar transações, calcular o score, gerar relatórios.</li>
        <li><strong>Gamificação:</strong> atribuir XP, evoluir mascote, desbloquear missões e badges.</li>
        <li><strong>Comunicação:</strong> enviar notificações diárias (se ativadas), responder a mensagens.</li>
        <li><strong>Faturação:</strong> processar subscrições pagas via Stripe.</li>
        <li><strong>Melhoria do produto:</strong> analisar eventos anónimos para priorizar funcionalidades.</li>
        <li><strong>Segurança:</strong> detetar abuso e cumprir obrigações legais.</li>
      </ol>

      <h2>4. Base legal (Art. 6º RGPD)</h2>
      <ul>
        <li><strong>Execução de contrato</strong> (Art. 6.1.b): tudo o que é necessário para a app funcionar.</li>
        <li><strong>Consentimento</strong> (Art. 6.1.a): notificações push, cookies analíticos.</li>
        <li><strong>Interesse legítimo</strong> (Art. 6.1.f): prevenção de fraude, logs de segurança.</li>
        <li><strong>Obrigação legal</strong> (Art. 6.1.c): retenção de registos fiscais de faturação.</li>
      </ul>

      <h2>5. Quem tem acesso aos teus dados (subcontratantes)</h2>
      <p>Partilhamos dados estritamente com os seguintes fornecedores, sob contrato de tratamento (Art. 28º RGPD):</p>
      <ul>
        <li><strong>Clerk</strong> (EUA, EU-US DPF) — autenticação.</li>
        <li><strong>Supabase</strong> (UE, Frankfurt) — base de dados e storage.</li>
        <li><strong>Vercel</strong> (EUA, EU-US DPF) — alojamento da aplicação.</li>
        <li><strong>Stripe</strong> (Irlanda) — processamento de pagamentos.</li>
        <li><strong>Google Gemini</strong> (UE) — scan de recibos e processamento de IA (imagens apagadas após processamento).</li>
        <li><strong>PostHog</strong> (UE) — analytics anonimizados.</li>
      </ul>
      <p>
        <strong>Não vendemos nem alugamos dados a terceiros.</strong> Qualquer transferência
        internacional é feita sob cláusulas contratuais-tipo aprovadas pela Comissão Europeia.
      </p>

      <h2>6. Quanto tempo guardamos os dados</h2>
      <ul>
        <li><strong>Conta ativa:</strong> enquanto usares a app.</li>
        <li><strong>Conta apagada:</strong> eliminação definitiva em 30 dias.</li>
        <li><strong>Faturação:</strong> 10 anos (obrigação legal PT).</li>
        <li><strong>Logs de erro:</strong> 30 dias.</li>
        <li><strong>Analytics:</strong> 2 anos, anonimizados.</li>
      </ul>

      <h2>7. Os teus direitos (Art. 15-22 RGPD)</h2>
      <p>Tens direito a, a qualquer momento:</p>
      <ul>
        <li><strong>Acesso:</strong> saber que dados temos sobre ti e obter uma cópia.</li>
        <li><strong>Retificação:</strong> corrigir dados incorretos.</li>
        <li><strong>Apagamento:</strong> &quot;direito a ser esquecido&quot; — apagamos tudo em 30 dias.</li>
        <li><strong>Portabilidade:</strong> exportar os teus dados num formato estruturado (JSON/CSV).</li>
        <li><strong>Oposição:</strong> opor-te a tratamentos baseados em interesse legítimo.</li>
        <li><strong>Retirar consentimento</strong> a qualquer momento (sem efeitos retroativos).</li>
        <li><strong>Reclamação:</strong> junto da <a href="https://www.cnpd.pt/" target="_blank" rel="noopener">CNPD</a> (Comissão Nacional de Proteção de Dados).</li>
      </ul>
      <p>
        Para exercer qualquer direito: <a href="/contacto">envia-nos uma mensagem</a> pelo
        formulário de contacto. Respondemos em <strong>30 dias corridos</strong>.
      </p>

      <h2>8. Segurança</h2>
      <p>Medidas técnicas e organizativas em vigor:</p>
      <ul>
        <li>Tráfego cifrado em TLS 1.3.</li>
        <li>Dados em repouso cifrados (AES-256) ao nível da base de dados.</li>
        <li>Autenticação via Clerk com suporte a MFA.</li>
        <li>Controlo de acesso por Row Level Security no Postgres.</li>
        <li>Backups diários cifrados, retidos 7 dias.</li>
        <li>Pagamentos processados pela Stripe (PCI-DSS Nível 1) — nunca vemos o teu cartão.</li>
      </ul>

      <h2>9. Menores</h2>
      <p>
        O serviço destina-se a pessoas com <strong>16 anos ou mais</strong>. Se tomarmos
        conhecimento de que uma conta foi criada por menor de 16 anos sem consentimento
        parental, apagaremos a conta.
      </p>

      <h2>10. Alterações a esta política</h2>
      <p>
        Podemos atualizar esta Política para refletir mudanças no serviço ou na legislação.
        Alterações substanciais serão comunicadas por email e/ou banner na app com pelo menos
        15 dias de antecedência.
      </p>

      <hr />
      <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)' }}>
        Documento sujeito ao direito português. Em caso de litígio, os tribunais competentes
        são os da comarca do domicílio do consumidor.
      </p>
    </>
  )
}
