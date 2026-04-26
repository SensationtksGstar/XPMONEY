export const metadata = {
  title:       'Termos de Serviço · XP-Money',
  description: 'As regras de utilização do XP-Money.',
}

/**
 * Termos de Serviço — governa a relação contratual entre utilizador e serviço.
 *
 * Ajustado em Abril 2026:
 *   - Modelo simplificado para 2 tiers (Free + Premium); referências a
 *     Plus/Pro/Family removidas
 *   - Política de não-reembolso explicitada ao abrigo do Art. 17.º n.º 1
 *     alínea m) do DL 24/2014 — utilizador pede execução imediata e
 *     reconhece perder o direito de livre resolução de 14 dias
 *   - Não substitui aconselhamento jurídico. Validar com advogado antes
 *     de tráfego em volume significativo.
 */
export default function TermosPage() {
  return (
    <>
      <h1>Termos de Serviço</h1>
      <p className="updated">Última atualização: 26 de abril de 2026</p>

      <div className="tldr">
        <strong>TL;DR:</strong> Usas o XP-Money gratuitamente ou pagas uma subscrição
        Premium. Cancelas quando quiseres — mantens acesso até ao fim do período pago.
        <strong> Não fazemos reembolsos:</strong> ao subscrever Premium pedes a execução
        imediata do serviço digital e reconheces perder o direito de livre resolução
        de 14 dias. Usa o plano Free para testar à vontade antes de pagares.
      </div>

      <h2>1. Objeto e aceitação</h2>
      <p>
        Estes Termos regulam a utilização da aplicação <strong>XP-Money</strong>{' '}
        (&quot;Serviço&quot;) — uma plataforma de finanças pessoais gamificadas acessível
        em <code>xp-money.com</code> (e <code>xp-money.pt</code>, que redireciona para o principal) e como PWA instalável.
      </p>
      <p>
        Ao criar uma conta ou utilizar o Serviço, declaras ter <strong>16 anos ou mais</strong>{' '}
        e aceitas estes Termos na íntegra. Se não concordares, não podes usar o Serviço.
      </p>

      <h2>2. A tua conta</h2>
      <ul>
        <li>És responsável por manter as tuas credenciais seguras (recomendamos MFA).</li>
        <li>Os dados que introduzes (transações, objetivos, etc.) são da tua responsabilidade.</li>
        <li>Uma conta por pessoa singular. Contas partilhadas não são permitidas.</li>
        <li>Podes apagar a tua conta a qualquer momento em Definições.</li>
      </ul>

      <h2>3. Utilização aceitável</h2>
      <p>Ao usar o XP-Money, comprometes-te a NÃO:</p>
      <ul>
        <li>Introduzir dados de terceiros sem consentimento.</li>
        <li>Tentar contornar limites de plano, manipular XP, criar múltiplas contas para abusar de ofertas.</li>
        <li>Fazer engenharia reversa ao código, aceder por meios automatizados não autorizados, sobrecarregar servidores (denial-of-service).</li>
        <li>Usar o Serviço para lavagem de capitais, financiamento de terrorismo, ou qualquer atividade ilícita.</li>
        <li>Publicar conteúdo ofensivo, discriminatório ou que viole direitos de terceiros (em campos livres como descrições).</li>
      </ul>
      <p>Violações podem levar à suspensão imediata da conta sem reembolso.</p>

      <h2>4. Subscrições e pagamento</h2>
      <ul>
        <li>Existem dois planos: <strong>Free</strong> (gratuito, com anúncios discretos) e <strong>Premium</strong> (€4,99/mês ou €39,99/ano, ~33% desconto no anual).</li>
        <li>O plano Premium é cobrado via <strong>Stripe</strong>, com renovação automática mensal ou anual conforme o ciclo escolhido.</li>
        <li>Podes cancelar a qualquer momento em <em>Definições → Subscrição</em>: o portal Stripe permite-te cancelar, alterar cartão e descarregar facturas. Após cancelamento mantens acesso Premium até ao fim do período já pago — não há reembolso parcial.</li>
        <li>Preços incluem IVA à taxa em vigor em Portugal.</li>
        <li>Alterações de preço são comunicadas por email com 30 dias de antecedência; podes cancelar antes da entrada em vigor.</li>
        <li>Pagamentos não recebidos resultam em downgrade automático para Free no fim do período.</li>
      </ul>

      <h2>5. Não-reembolso e direito de livre resolução</h2>
      <p>
        <strong>Não fazemos reembolsos</strong> de subscrições Premium pagas. Ao subscrever,
        confirmas expressamente que:
      </p>
      <ul>
        <li><strong>Solicitas o início imediato</strong> da execução do serviço digital — todas as funcionalidades Premium ficam disponíveis instantaneamente após o pagamento.</li>
        <li><strong>Reconheces perder o direito de livre resolução de 14 dias</strong>, nos termos do Art. 17.º n.º 1 alínea m) do Decreto-Lei n.º 24/2014, dado tratar-se de fornecimento de conteúdos digitais cuja execução começou com o teu consentimento prévio.</li>
        <li>O plano <strong>Free</strong> permanece disponível em permanência para testares todas as funcionalidades-base sem qualquer compromisso financeiro — usa-o para avaliar o serviço antes de pagar.</li>
      </ul>
      <p>
        <strong>Excepções obrigatórias por lei:</strong> reembolsos são concedidos
        em caso de (i) cobrança duplicada por falha técnica, (ii) inexecução total e
        permanente do serviço por nossa responsabilidade durante todo o período pago,
        ou (iii) outros casos imperativos da legislação portuguesa do consumo.
      </p>
      <p>
        Pedidos de reembolso ao abrigo destas excepções são apresentados pelo{' '}
        <a href="/contacto">formulário de contacto</a> com prova documental e analisados
        no prazo máximo de 14 dias.
      </p>

      <h2>6. Propriedade intelectual</h2>
      <ul>
        <li>Nós detemos a app, marca, mascotes Voltix e Penny, cursos da Academia, e todo o conteúdo original.</li>
        <li>Tu manténs a propriedade do conteúdo que introduzes (transações, notas de objetivos).</li>
        <li>Concedes-nos uma licença limitada para processar o teu conteúdo estritamente para te fornecer o Serviço.</li>
      </ul>

      <h2>7. Disponibilidade e limitação de responsabilidade</h2>
      <p>
        Esforçamo-nos por ter o Serviço sempre disponível, mas <strong>não garantimos 99,99% uptime</strong>.
        O Serviço é fornecido &quot;tal qual&quot; e &quot;conforme disponível&quot;.
      </p>
      <p>Na medida máxima permitida por lei, não somos responsáveis por:</p>
      <ul>
        <li>Decisões financeiras que tomes com base em informação da app — esta <strong>não substitui aconselhamento financeiro profissional</strong>.</li>
        <li>Perda de dados causada por ações tuas (incluindo usar a função &quot;Apagar tudo&quot;).</li>
        <li>Indisponibilidade temporária por manutenção ou falha de terceiros (Vercel, Supabase, Stripe).</li>
        <li>Danos indiretos, lucros cessantes, perda de oportunidade.</li>
      </ul>
      <p>
        A nossa responsabilidade total está limitada ao valor que pagaste nos últimos
        12 meses de subscrição, salvo em caso de dolo ou negligência grosseira.
      </p>

      <h2>8. Privacidade e dados pessoais</h2>
      <p>
        O tratamento de dados pessoais é regido pela nossa{' '}
        <a href="/privacidade">Política de Privacidade</a>, que faz parte integrante
        destes Termos.
      </p>

      <h2>9. Cessação</h2>
      <ul>
        <li><strong>Por ti:</strong> a qualquer momento, apagando a conta.</li>
        <li><strong>Por nós:</strong> em caso de violação destes Termos, com notificação por email e 7 dias para sanar (exceto violações graves, que podem levar a suspensão imediata).</li>
      </ul>
      <p>Após cessação, os teus dados são apagados nos termos da Política de Privacidade.</p>

      <h2>10. Lei aplicável e foro</h2>
      <p>
        Estes Termos regem-se pela lei portuguesa. Para litígios relativos a consumidores, o
        foro competente é o do <strong>domicílio do consumidor</strong>. Disputas podem também
        ser submetidas a resolução extrajudicial através do{' '}
        <a href="https://www.consumidor.gov.pt" target="_blank" rel="noopener">Portal do Consumidor</a> ou
        da plataforma europeia de{' '}
        <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener">Resolução de Litígios em Linha</a>.
      </p>

      <h2>11. Alterações aos Termos</h2>
      <p>
        Podemos atualizar estes Termos. Alterações substanciais serão comunicadas por email com
        15 dias de antecedência. Continuar a usar o Serviço após a entrada em vigor equivale
        a aceitação.
      </p>

      <hr />
      <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)' }}>
        Dúvidas sobre estes Termos? <a href="/contacto">Contacta-nos</a>.
      </p>
    </>
  )
}
