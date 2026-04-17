// ── XP-Money — Course Catalog ────────────────────────────────────────────────
// Static course data. Progress tracked in localStorage.

export interface QuizQuestion {
  id:      string
  text:    string
  options: string[]
  correct: number   // index into options
}

export interface Lesson {
  id:      string
  title:   string
  emoji:   string
  content: string   // markdown-like rich text (paragraphs separated by \n\n)
  duration: number  // minutes
}

export interface Course {
  id:          string
  title:       string
  subtitle:    string
  emoji:       string
  color:       string   // tailwind gradient classes
  level:       'Iniciante' | 'Intermédio' | 'Avançado'
  duration:    number   // total minutes
  lessons:     Lesson[]
  quiz:        QuizQuestion[]
  certificate: { title: string; description: string }
  /**
   * Plan gate. No modelo 2-tier só existe `premium`.
   * `plus`/`pro` são aliases legacy para dados antigos — quem tiver
   * `plus` ou `pro` no DB é tratado como premium no runtime.
   */
  plan:        'premium' | 'plus' | 'pro'
}

export const COURSES: Course[] = [
  {
    id:       'gestao-basica',
    title:    'Fundamentos de Gestão Financeira',
    subtitle: 'Aprende a controlar o teu dinheiro e a construir hábitos sólidos',
    emoji:    '💰',
    color:    'from-green-600 to-emerald-500',
    level:    'Iniciante',
    duration: 30,
    plan:     'premium',
    certificate: {
      title:       'Certificado em Gestão Financeira Básica',
      description: 'Dominou os fundamentos de orçamento pessoal, fundo de emergência e eliminação de dívidas.',
    },
    lessons: [
      {
        id:       'l1',
        emoji:    '🧭',
        title:    'O que é a saúde financeira?',
        duration: 6,
        content: `A saúde financeira é a capacidade de gerir o teu dinheiro de forma a garantir estabilidade, segurança e liberdade — agora e no futuro. Tal como a saúde física, não é um destino mas um percurso contínuo.

**Os 4 pilares da saúde financeira:**
→ **Liquidez** — Ter dinheiro disponível para emergências (pelo menos 3 meses de despesas)
→ **Equilíbrio** — Gastar menos do que ganhas, consistentemente
→ **Crescimento** — Fazer o teu dinheiro trabalhar para ti (poupança e investimento)
→ **Proteção** — Seguros, fundo de emergência, sem dívidas de alto risco

**Por que é que a maioria falha?**
Não é falta de conhecimento — é falta de sistema. Sem um método claro, o dinheiro "desaparece" sem explicação. A XP-Money resolve exatamente isso: torna a gestão financeira num jogo que queres ganhar.

**O Score XP-Money** mede estes 4 pilares e dá-te um número entre 0 e 100. O teu objetivo é subir esse número, semana após semana. É simples, mensurável e motivante.`,
      },
      {
        id:       'l2',
        emoji:    '📊',
        title:    'Orçamento Pessoal — Método 50/30/20',
        duration: 8,
        content: `O orçamento 50/30/20 é a regra de ouro das finanças pessoais. Divide o teu rendimento líquido mensal em 3 categorias simples:

**50% — Necessidades**
Tudo o que precisas para viver: renda/hipoteca, alimentação, transportes, saúde, utilidades. Se este valor ultrapassar 50%, é sinal de que as tuas despesas fixas são demasiado elevadas.

**30% — Desejos**
Restaurantes, lazer, viagens, subscrições de streaming, roupas não essenciais. Esta é a categoria mais fácil de reduzir quando necessário.

**20% — Poupança e Investimento**
Este é o valor que vai construir o teu futuro: fundo de emergência, poupança para objetivos e investimentos a longo prazo.

**Exemplo prático com €1.200/mês líquidos:**
→ Necessidades: €600 (renda €450 + alimentação €100 + transporte €50)
→ Desejos: €360 (saídas €150 + streaming €30 + roupas €80 + outros €100)
→ Poupança: €240 (fundo emergência €100 + objetivo férias €80 + investimento €60)

Na XP-Money, categoriza cada transação e vê automaticamente em que percentagem estás. O Score ajusta-se em tempo real.`,
      },
      {
        id:       'l3',
        emoji:    '🛡️',
        title:    'Fundo de Emergência',
        duration: 7,
        content: `O fundo de emergência é a base de qualquer plano financeiro sólido. Sem ele, uma despesa inesperada — carro avariado, problema de saúde, perda de emprego — pode destruir anos de poupança.

**Quanto deves ter?**
→ **Mínimo:** 3 meses de despesas essenciais
→ **Ideal:** 6 meses de despesas totais
→ **Conservador:** 12 meses (se tens dependentes ou trabalho instável)

**Onde guardar?**
O fundo de emergência deve estar **separado da conta corrente** (para não gastar sem pensar) mas **imediatamente acessível** (não em investimentos):
→ Conta poupança com boa liquidez
→ Certificados de Aforro (Portugal) — capital garantido e liquidez em 30 dias
→ ETF monetário de baixo risco (mais rendimento, acessível em 2-3 dias)

**Como construir rapidamente?**
1. Define o valor-alvo (ex: €5.000 para 6 meses de €830/mês)
2. Cria um Objetivo na XP-Money com esse valor
3. Automatiza uma transferência no início de cada mês (mesmo que pequena — €50 já conta)
4. Trata como despesa obrigatória, não como opção

A consistência é tudo. €100/mês durante 12 meses é muito melhor do que €1.200 numa decisão impulsiva que depois reveres.`,
      },
      {
        id:       'l4',
        emoji:    '⛓️',
        title:    'Dívidas — Como Eliminá-las',
        duration: 9,
        content: `A dívida é o maior obstáculo à liberdade financeira. Mas nem todas as dívidas são iguais.

**Dívida "boa" vs dívida "má":**
→ **Boa:** Hipoteca a taxa baixa, crédito estudantil — gera ativo ou aumenta capacidade de ganho
→ **Má:** Cartão de crédito, crédito pessoal de consumo, compras a prestações com juros altos — apenas antecipa gastos futuros

**Os 2 métodos mais eficazes:**

🔴 **Método Avalanche (matematicamente ótimo)**
Paga o mínimo em todas as dívidas. O dinheiro extra vai para a de juro mais alto. Quando eliminas essa, passa para a seguinte. Poupa mais dinheiro em juros.

🟡 **Método Bola de Neve (psicologicamente eficaz)**
Paga o mínimo em todas. O extra vai para a de valor mais baixo. Eliminar dívidas rápido dá motivação para continuar. Custa ligeiramente mais mas a maioria consegue manter.

**Exemplo — 3 dívidas:**
| Dívida | Valor | Juro |
|--------|-------|------|
| Cartão | €400 | 24% |
| Pessoal | €2.000 | 12% |
| Carro | €5.000 | 5% |

Com Avalanche: foca o cartão (24%) → pessoal → carro
Com Bola de Neve: foca o cartão (€400) → pessoal → carro

**Regra de ouro:** Nunca investires antes de eliminares dívidas com juro >7%. O retorno médio de investimento (~7% ao ano) não compensa pagar 12-24% em juros.`,
      },
    ],
    quiz: [
      {
        id: 'q1',
        text: 'No método 50/30/20, qual é a percentagem destinada a poupança e investimento?',
        options: ['10%', '20%', '30%', '50%'],
        correct: 1,
      },
      {
        id: 'q2',
        text: 'Qual é o valor mínimo recomendado para um fundo de emergência?',
        options: ['1 mês de despesas', '3 meses de despesas essenciais', '6 meses de salário', '€10.000 fixos'],
        correct: 1,
      },
      {
        id: 'q3',
        text: 'No método Avalanche de eliminação de dívidas, qual dívida atacamos primeiro?',
        options: ['A de valor mais alto', 'A de juro mais alto', 'A de valor mais baixo', 'A mais antiga'],
        correct: 1,
      },
      {
        id: 'q4',
        text: 'Onde NÃO deves guardar o fundo de emergência?',
        options: ['Conta poupança', 'Certificados de Aforro', 'Criptomoedas voláteis', 'ETF monetário'],
        correct: 2,
      },
      {
        id: 'q5',
        text: 'Qual dos seguintes é um exemplo de dívida "boa"?',
        options: ['Crédito pessoal a 18%', 'Compras a prestações no cartão', 'Hipoteca a taxa fixa de 3%', 'Descoberto bancário'],
        correct: 2,
      },
    ],
  },

  {
    id:       'investimento-iniciantes',
    title:    'Investimento para Iniciantes',
    subtitle: 'Descobre como fazer o teu dinheiro crescer com estratégias simples e seguras',
    emoji:    '📈',
    color:    'from-blue-600 to-indigo-500',
    level:    'Intermédio',
    duration: 35,
    plan:     'premium',
    certificate: {
      title:       'Certificado em Investimento Básico',
      description: 'Compreendeu os princípios de risco/retorno, ETFs, juro composto e construção de carteira diversificada.',
    },
    lessons: [
      {
        id:       'l1',
        emoji:    '🚀',
        title:    'Por onde começar a investir',
        duration: 7,
        content: `Investir não é apenas para ricos. Com €50/mês e consistência, qualquer pessoa pode construir riqueza a longo prazo. A barreira não é o capital — é o conhecimento e o hábito.

**Antes de investires, confirma:**
✅ Tens fundo de emergência (3-6 meses de despesas)
✅ Não tens dívidas com juro >7%
✅ Tens rendimento estável (pelo menos parcial)

**Os principais veículos de investimento:**
→ **Depósitos a prazo** — Juro garantido, capital protegido. Ideal para curto prazo (<2 anos)
→ **Obrigações** — Empréstimos a empresas/governos com juro fixo. Risco baixo-médio
→ **Ações** — Participação em empresas. Volatilidade alta, retorno histórico ~7-10%/ano
→ **ETFs** — Cesta de ações/obrigações num único produto. A melhor opção para iniciantes
→ **Imobiliário** — Requer capital elevado mas é tangível e familiar

**A regra dos 100:**
Subtrai a tua idade a 100. Esse é o % ideal em ações:
→ 25 anos → 75% ações, 25% obrigações/cash
→ 45 anos → 55% ações, 45% obrigações/cash
→ 65 anos → 35% ações, 65% obrigações/cash

Quanto mais novo, mais tempo tens para recuperar de quedas — logo, podes assumir mais risco.`,
      },
      {
        id:       'l2',
        emoji:    '⚖️',
        title:    'Risco e Retorno',
        duration: 8,
        content: `A relação entre risco e retorno é a lei fundamental do investimento: **maior retorno potencial exige maior risco**. Não há almoços grátis nos mercados financeiros.

**Tipos de risco:**
→ **Risco de mercado** — O preço do ativo sobe e desce. Inevitável nos mercados
→ **Risco de empresa** — A empresa em que investiste vai mal. Resolve-se com diversificação
→ **Risco de inflação** — O teu dinheiro perde poder de compra. Dinheiro no banco perde valor
→ **Risco de liquidez** — Não consegues vender o ativo quando precisas (ex: imobiliário)

**A volatilidade não é o inimigo:**
Uma carteira de ações pode cair 30-40% numa crise. Mas historicamente recuperou e subiu ainda mais. O problema não é a queda — é vender quando está em queda.

**Regra de ouro:**
→ Dinheiro que precisas em <2 anos → NÃO invistas em ações
→ Dinheiro que não vais precisar em 5+ anos → Ações/ETFs são adequados
→ Dinheiro para emergências → 100% líquido e seguro

**Perfil de risco:**
Sê honesto contigo. Se ao ver o teu investimento a cair 20% dormires mal e quiseres vender tudo — o teu perfil é conservador. Não há problema nisso. O melhor investimento é o que consegues manter nos momentos difíceis.`,
      },
      {
        id:       'l3',
        emoji:    '🧺',
        title:    'ETFs — O Melhor Amigo do Investidor Passivo',
        duration: 10,
        content: `Um ETF (Exchange-Traded Fund) é um fundo que replica um índice de mercado (ex: S&P 500, MSCI World) e é negociado em bolsa como uma ação. É, de longe, a melhor forma de começar a investir.

**Por que ETFs são ideais para iniciantes:**
→ **Diversificação imediata** — Um ETF do S&P 500 dá-te exposição a 500 empresas americanas de uma vez
→ **Custos baixos** — TER (Total Expense Ratio) de 0,03% a 0,20% ao ano, vs 1,5-2,5% de fundos ativos
→ **Transparência** — Sabes exatamente o que estás a comprar
→ **Liquidez** — Compras e vendes a qualquer momento durante o horário de bolsa

**Os ETFs mais populares para iniciantes:**
| ETF | Índice | TER | O que inclui |
|-----|--------|-----|-------------|
| VWCE | FTSE All-World | 0,22% | ~3.700 empresas globais |
| CSPX | S&P 500 | 0,07% | 500 maiores EUA |
| IWDA | MSCI World | 0,20% | 1.500 empresas países desenvolvidos |

**Onde comprar ETFs em Portugal:**
→ Interactive Brokers (comissões mais baixas, ideal para valores acima de €1.000)
→ Trading 212 (sem comissão, frações de ETF, ótimo para começar)
→ Degiro (comissões baixas, interface simples)

**Estratégia DCA (Dollar-Cost Averaging):**
Investe um valor fixo todos os meses, independentemente do preço. Em meses de queda compras mais barato. Em meses de subida compras menos. A média do custo é otimizada automaticamente.`,
      },
      {
        id:       'l4',
        emoji:    '✨',
        title:    'O Juro Composto — A 8ª Maravilha do Mundo',
        duration: 10,
        content: `"Aquele que compreende o juro composto, ganha-o. Aquele que não compreende, paga-o." — Albert Einstein (atribuído)

**O que é o juro composto?**
É quando os teus juros geram novos juros. O teu dinheiro trabalha, e os frutos do trabalho do teu dinheiro também trabalham. É uma bola de neve financeira.

**Exemplo concreto:**
€10.000 investidos a 7%/ano durante 30 anos:
→ Sem juro composto (apenas o capital inicial): €10.000 + €21.000 juros = €31.000
→ Com juro composto: €76.122 (!!)

**A fórmula mágica: A = P × (1 + r)^t**
→ P = Capital inicial (€10.000)
→ r = Taxa de retorno (0,07 = 7%)
→ t = Anos (30)
→ A = €10.000 × (1,07)^30 = €76.122

**O tempo é o ingrediente mais importante:**

| Investes | Durante | Resultado |
|---------|---------|-----------|
| €200/mês | 20 anos | ~€104.000 |
| €200/mês | 30 anos | ~€227.000 |
| €200/mês | 40 anos | ~€528.000 |

A diferença entre 30 e 40 anos não é 33% mais — é 132% mais. O juro composto acelera exponencialmente.

**A lição:** Começa hoje. Um ano de atraso não é uma pequena diferença — é décadas de crescimento composto perdido. Com a XP-Money podes criar um Objetivo de investimento e ver a projeção de crescimento em tempo real.`,
      },
    ],
    quiz: [
      {
        id: 'q1',
        text: 'O que é um ETF?',
        options: [
          'Um tipo de conta bancária com juro garantido',
          'Um fundo que replica um índice e é negociado em bolsa',
          'Um seguro de vida ligado a investimento',
          'Um certificado emitido pelo Estado',
        ],
        correct: 1,
      },
      {
        id: 'q2',
        text: 'Qual a principal vantagem do DCA (Dollar-Cost Averaging)?',
        options: [
          'Garante retorno positivo sempre',
          'Elimina o risco de mercado completamente',
          'Suaviza o preço médio de compra ao longo do tempo',
          'Permite comprar sempre no preço mais baixo',
        ],
        correct: 2,
      },
      {
        id: 'q3',
        text: 'Antes de investir em ações, o que deves confirmar?',
        options: [
          'Que tens pelo menos €10.000 disponíveis',
          'Que tens fundo de emergência e sem dívidas de juro alto',
          'Que os mercados estão em alta',
          'Que tens um gestor de carteira profissional',
        ],
        correct: 1,
      },
      {
        id: 'q4',
        text: 'Segundo a regra dos 100, uma pessoa com 30 anos deve ter que % em ações?',
        options: ['30%', '50%', '70%', '100%'],
        correct: 2,
      },
      {
        id: 'q5',
        text: 'O que acontece com €5.000 investidos a 7%/ano durante 20 anos com juro composto?',
        options: [
          'Ficam €12.000',
          'Ficam €19.348',
          'Ficam €7.000',
          'Ficam €35.000',
        ],
        correct: 1,
      },
    ],
  },

  {
    id:       'poupanca-independencia',
    title:    'Poupança e Independência Financeira',
    subtitle: 'Define a tua taxa de poupança e traça o caminho para a liberdade financeira',
    emoji:    '🏆',
    color:    'from-purple-600 to-violet-500',
    level:    'Avançado',
    duration: 40,
    plan:     'premium',
    certificate: {
      title:       'Certificado em Independência Financeira',
      description: 'Dominou os conceitos de taxa de poupança, movimento FIRE e automatização financeira.',
    },
    lessons: [
      {
        id:       'l1',
        emoji:    '🧠',
        title:    'A Mentalidade do Poupador',
        duration: 8,
        content: `A maior barreira à poupança não é o rendimento — é a mentalidade. Pessoas com rendimentos altos podem viver no limite todos os meses. Pessoas com rendimentos modestos podem acumular riqueza. A diferença está na forma como pensam sobre o dinheiro.

**A Inflação do Estilo de Vida:**
Quando ganhas mais, começas a gastar mais — automaticamente. Este fenómeno chama-se "lifestyle inflation". Novo emprego, salário 20% mais alto? Em 6 meses, as tuas despesas adaptam-se e continuas sem poupar.

**Como combater:**
Sempre que o teu rendimento aumentar, aloca pelo menos 50% desse aumento extra para poupança/investimento. Se ganhas +€200/mês, €100 vai para poupança, €100 para melhorar o estilo de vida. Cresces nos dois sentidos.

**Poupador vs. Consumidor — dois mundos paralelos:**
→ **Consumidor:** Recebe salário → paga despesas → gasta o resto → eventualmente poupa
→ **Poupador:** Recebe salário → poupa primeiro → vive com o resto

A ordem importa. Se poupas o que sobra, raramente sobra algo. Se gastas o que sobra após poupar, o estilo de vida adapta-se.

**O que te motiva mais?**
Identificar o teu "porquê" é essencial. Liberdade para trabalhar em projetos que amas? Nunca precisar de dizer sim a um chefe tóxico por necessidade financeira? Viagens? Aposentação antecipada? O XP-Money ajuda-te a transformar esse objetivo abstrato num número concreto com prazo definido.`,
      },
      {
        id:       'l2',
        emoji:    '📐',
        title:    'Taxa de Poupança — O Número que Define Tudo',
        duration: 10,
        content: `A taxa de poupança é a percentagem do teu rendimento líquido que poupas e/ou investes mensalmente. É o indicador mais importante das tuas finanças pessoais.

**Fórmula:**
Taxa de Poupança = (Poupança Mensal / Rendimento Líquido Mensal) × 100

**O impacto brutal da taxa de poupança:**
| Taxa de Poupança | Anos até à Independência Financeira |
|-----------------|--------------------------------------|
| 5% | 66 anos |
| 10% | 51 anos |
| 20% | 37 anos |
| 35% | 25 anos |
| 50% | 17 anos |
| 65% | 10 anos |

*Assumindo retorno de investimento de 7%/ano e estilo de vida constante*

**Porque é que a taxa importa mais do que o valor absoluto?**
€500/mês de poupança num salário de €2.500 (20%) tem o mesmo efeito temporal que €1.500/mês num salário de €7.500 (20%). O que importa é a proporção, não o número.

**Como aumentar a taxa de poupança:**
→ Aumentar rendimento (promoção, freelance, segundo emprego)
→ Reduzir despesas fixas (renda menor, carro mais barato)
→ Eliminar gastos inconscientes (subscrições esquecidas, compras impulsivas)
→ Renegociar contratos (seguros, internet, telemóvel)

Na XP-Money, a taxa de poupança aparece no teu Score financeiro. O objetivo: manter acima de 20% todos os meses.`,
      },
      {
        id:       'l3',
        emoji:    '🔥',
        title:    'Movimento FIRE — Independência Financeira',
        duration: 12,
        content: `FIRE significa Financial Independence, Retire Early — Independência Financeira, Reforma Antecipada. É um movimento crescente de pessoas que otimizam as suas finanças para alcançar a liberdade financeira décadas antes da reforma tradicional.

**O Número Mágico — A Regra dos 4%:**
A regra dos 4% (baseada no Trinity Study de 1998) diz que podes retirar 4% do teu portfólio por ano sem o esgotar durante 30+ anos.

O teu número FIRE = Despesas anuais × 25

**Exemplos:**
→ Despesas: €1.500/mês = €18.000/ano → FIRE = €450.000
→ Despesas: €2.500/mês = €30.000/ano → FIRE = €750.000
→ Despesas: €4.000/mês = €48.000/ano → FIRE = €1.200.000

**Variantes do FIRE:**
→ **Lean FIRE** — Viver com muito pouco (<€1.000/mês). Máxima frugalidade
→ **Fat FIRE** — Independência com estilo de vida confortável (>€4.000/mês)
→ **Barista FIRE** — Semi-reforma: cobres despesas básicas com trabalho part-time prazeroso
→ **Coast FIRE** — Já tens o suficiente investido e só tens de esperar o juro composto fazer o resto

**FIRE em Portugal:**
O custo de vida relativamente baixo, o NHR (Residente Não Habitual) para rendimentos de investimento, e o clima favorável tornam Portugal um destino FIRE popular para europeus e americanos. Para portugueses, o número é mais acessível do que para americanos ou britânicos.

**A crítica ao FIRE:**
Alguns argumentam que "reformar" cedo é vazio. A resposta do movimento: FIRE não é sobre deixar de trabalhar — é sobre trabalhar porque queres, não porque precisas. É liberdade de escolha.`,
      },
      {
        id:       'l4',
        emoji:    '🤖',
        title:    'Automatizar as Poupanças',
        duration: 10,
        content: `A automatização é o segredo dos poupadores de sucesso. Remove a força de vontade da equação — e isso é bom, porque a força de vontade é um recurso limitado.

**Sistema de automatização em 4 passos:**

**Passo 1 — Conta Poupança Separada**
Abre uma conta separada da tua conta corrente, idealmente noutro banco para criar fricção. Chama-lhe "Poupança Intocável" ou o nome do teu objetivo.

**Passo 2 — Transferência Automática no Dia de Pagamento**
No mesmo dia em que recebes o salário, configura uma transferência automática para a conta de poupança. Nunca verás esse dinheiro na conta corrente — o que não vês, não gastas.

**Passo 3 — Investimento Automático Mensal**
Se já tens fundo de emergência, configura um plano de investimento automático (DCA) na plataforma que usas (Trading 212, DEGIRO, etc.). Valor fixo, mesmo dia todo mês.

**Passo 4 — Revisão Trimestral (não mensal)**
Verificar a carteira todos os dias é ansiedade sem propósito. Revê trimestralmente: estás a poupar o % planeado? A taxa de poupança manteve-se? Alguma despesa cresceu sem notar?

**Ferramentas portuguesas úteis:**
→ MB Way ou homebanking — transferências automáticas agendadas
→ Aplicação do banco — notificações de saldo
→ XP-Money — acompanhar score, poupanças e missões em tempo real

**Regra final:** A configuração demora 2 horas. Depois funciona sozinha. Essa é a beleza da automatização — o esforço é feito uma vez, os benefícios duram décadas.`,
      },
    ],
    quiz: [
      {
        id: 'q1',
        text: 'O que significa FIRE?',
        options: [
          'Financial Investment Return Economy',
          'Financial Independence, Retire Early',
          'Future Income Retirement Estimate',
          'Fixed Income Retirement Earnings',
        ],
        correct: 1,
      },
      {
        id: 'q2',
        text: 'Segundo a Regra dos 4%, qual é o "número FIRE" para despesas de €2.000/mês?',
        options: ['€240.000', '€480.000', '€600.000', '€800.000'],
        correct: 2,
      },
      {
        id: 'q3',
        text: 'O que é a "inflação do estilo de vida"?',
        options: [
          'A inflação que afeta bens de luxo',
          'O fenómeno de gastar mais quando o rendimento aumenta',
          'O aumento do custo de vida ao longo dos anos',
          'A desvalorização dos ativos com o tempo',
        ],
        correct: 1,
      },
      {
        id: 'q4',
        text: 'Qual taxa de poupança permite alcançar independência financeira em ~17 anos?',
        options: ['20%', '35%', '50%', '65%'],
        correct: 2,
      },
      {
        id: 'q5',
        text: 'Qual é o principal benefício de automatizar as poupanças?',
        options: [
          'Garante retornos mais altos',
          'Elimina os impostos sobre ganhos',
          'Remove a dependência de força de vontade diária',
          'Permite aceder ao dinheiro mais rapidamente',
        ],
        correct: 2,
      },
    ],
  },
]

// ── Progress helpers (localStorage) ──────────────────────────────────────────

export interface CourseProgress {
  completedLessons: string[]
  quizScore:        number | null   // null = not taken, 0-100
  completedAt:      string | null   // ISO date
  certificateAt:    string | null
}

const KEY = (uid: string, cid: string) => `xpm_course_${uid}_${cid}`

export function getCourseProgress(userId: string, courseId: string): CourseProgress {
  if (typeof window === 'undefined') return { completedLessons: [], quizScore: null, completedAt: null, certificateAt: null }
  try {
    const raw = localStorage.getItem(KEY(userId, courseId))
    return raw ? JSON.parse(raw) : { completedLessons: [], quizScore: null, completedAt: null, certificateAt: null }
  } catch {
    return { completedLessons: [], quizScore: null, completedAt: null, certificateAt: null }
  }
}

export function saveCourseProgress(userId: string, courseId: string, progress: Partial<CourseProgress>) {
  if (typeof window === 'undefined') return
  const current = getCourseProgress(userId, courseId)
  const updated  = { ...current, ...progress }
  localStorage.setItem(KEY(userId, courseId), JSON.stringify(updated))
}

export function markLessonComplete(userId: string, courseId: string, lessonId: string) {
  const current = getCourseProgress(userId, courseId)
  const lessons  = [...new Set([...current.completedLessons, lessonId])]
  saveCourseProgress(userId, courseId, { completedLessons: lessons })
}

/**
 * Wipe every course progress entry for this user (all courses).
 *
 * Used by the "reset account" flow: the user asked that clicking "apagar
 * todas as transações" also removes their certificates so the account is
 * truly back to zero. Course progress lives in localStorage (not the DB),
 * so the server-side reset endpoint can't touch it — we must sweep here,
 * client-side, after the fetch succeeds.
 */
export function clearAllCourseProgress(userId: string) {
  if (typeof window === 'undefined') return
  try {
    const prefix = `xpm_course_${userId}_`
    const toRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith(prefix)) toRemove.push(k)
    }
    toRemove.forEach(k => localStorage.removeItem(k))
  } catch { /* storage disabled — non-critical */ }
}
