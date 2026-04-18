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

  {
    id:       'impostos-irs',
    title:    'Impostos e IRS em Portugal',
    subtitle: 'Percebe o IRS, escalões e benefícios fiscais — paga o justo, nem mais nem menos',
    emoji:    '🧾',
    color:    'from-orange-600 to-amber-500',
    level:    'Intermédio',
    duration: 28,
    plan:     'premium',
    certificate: {
      title:       'Certificado em Fiscalidade Pessoal',
      description: 'Compreendeu o funcionamento do IRS, escalões progressivos, benefícios fiscais e boas práticas declarativas em Portugal.',
    },
    lessons: [
      {
        id:       'l1',
        emoji:    '📐',
        title:    'Como funciona o IRS — escalões e taxas',
        duration: 7,
        content: `O IRS (Imposto sobre o Rendimento das Pessoas Singulares) é progressivo — quanto mais ganhas, maior a taxa marginal. Mas **a taxa marginal não se aplica a tudo**: só ao valor que cai dentro de cada escalão.

**Escalões 2026 (indicativos, confirmar no Portal das Finanças):**
→ Até €8.059 → 13,00%
→ €8.059 a €12.160 → 16,50%
→ €12.160 a €17.233 → 22,00%
→ €17.233 a €22.306 → 25,00%
→ €22.306 a €28.400 → 32,00%
→ €28.400 a €41.629 → 35,50%
→ €41.629 a €44.987 → 43,50%
→ €44.987 a €83.696 → 45,00%
→ Acima de €83.696 → 48,00%

**Exemplo prático — rendimento colectável €25.000:**
Não pagas 32% sobre os €25.000. Pagas:
→ 13% sobre os primeiros €8.059 = €1.048
→ 16,5% sobre €4.101 (do 2º escalão) = €677
→ 22% sobre €5.073 (3º) = €1.116
→ 25% sobre €5.073 (4º) = €1.268
→ 32% sobre €2.694 (parte do 5º) = €862
Total ≈ €4.971 → taxa **efectiva** ~19,9% (não 32%)

A taxa efectiva é sempre menor do que a marginal. É isto que faz sentido quando dizem "subir de escalão compensa sempre receber mais".`,
      },
      {
        id:       'l2',
        emoji:    '🎯',
        title:    'Deduções, retenções e acerto anual',
        duration: 7,
        content: `Durante o ano, a tua entidade patronal retém IRS mensalmente com base numa tabela indicativa. Essa **retenção na fonte** é uma estimativa. O acerto real acontece na declaração anual (entre Abril e Junho do ano seguinte).

**Principais deduções à colecta:**
→ **Despesas gerais familiares** — 35% do IVA suportado, até €250/adulto, €125/criança
→ **Saúde** — 15% das despesas, até €1.000
→ **Educação** — 30%, até €800
→ **Lares** — 25%, até €403,75
→ **Imóveis (arrendamento)** — 15% das rendas pagas, até €502
→ **PPR** — 20% do valor investido (com limites por idade)

**Como maximizar o reembolso:**
1. **Pede factura com NIF em tudo** — Mesmo o café conta para as despesas gerais
2. **Valida facturas no e-fatura** até 25 de Fevereiro
3. **Confirma a categorização** — uma factura mal categorizada pode valer €50-100 de reembolso
4. **Considera PPR** se já tens o fundo de emergência feito

**A regra prática:** o dinheiro que te sobra da retenção é reembolsado em Junho-Julho do ano seguinte. Quem paga menos durante o ano recebe menos (ou paga acerto). Não é "ganhar" nem "perder" — é apenas cashflow.`,
      },
      {
        id:       'l3',
        emoji:    '💼',
        title:    'Recibos verdes (trabalhador independente)',
        duration: 7,
        content: `Se és freelancer ou trabalhador independente passas recibos verdes. O IRS é **diferente** — calculado sobre rendimento líquido após aplicação do coeficiente.

**Coeficientes por actividade:**
→ Serviços profissionais (advogado, médico, designer, programador) → **0,75**
→ Comércio/indústria → **0,15**
→ Vendas de mercadorias e restauração → **0,15**
→ Prestação de serviços intelectuais → **0,35**

**Exemplo:** Programador factura €30.000/ano. Rendimento colectável = €30.000 × 0,75 = €22.500. É sobre estes €22.500 que se aplicam os escalões.

**IVA:**
→ Até €15.000/ano → isento (regime de isenção)
→ Acima → regime normal (liquidas IVA, declaras trimestralmente)

**Segurança Social:**
→ Contribuição trimestral baseada no rendimento declarado
→ Primeira paga só após 12 meses de actividade (isenção inicial)
→ Taxa: 21,4% sobre 70% do rendimento relevante

**Regra de ouro:** reserva sempre **30-35% do facturado** numa conta separada. Nunca gastes o IVA nem o IRS — não é teu. Automatiza uma transferência para poupança no próprio dia que recebes.

Na XP-Money categoriza transações recebidas como "rendimento" para veres a taxa de poupança real — o que é facturado menos IRS e SS estimados.`,
      },
      {
        id:       'l4',
        emoji:    '✅',
        title:    'Declaração anual — erros comuns',
        duration: 7,
        content: `A declaração de IRS faz-se no Portal das Finanças entre **1 de Abril e 30 de Junho**. Para a maioria das pessoas é **pré-preenchida** — basta validar.

**Erros que custam dinheiro:**
❌ **Não validar facturas no e-fatura** — Se não fores ao e-fatura até 25 Fev, as facturas pendentes não contam
❌ **Não declarar rendimentos de investimentos** — Juros, dividendos, mais-valias de acções (tipicamente 28%, podem ser englobados se interessar)
❌ **Não aproveitar o englobamento** quando a taxa marginal é baixa — Algumas rendas e ganhos podem ser melhor tributados dentro do IRS do que autonomamente
❌ **Trocar rendimentos entre cônjuges** em regime de tributação separada sem simular os dois cenários
❌ **Entregar em cima do prazo** — se precisares de corrigir ficas sem tempo

**O simulador oficial:**
Antes de submeter, usa o simulador do Portal das Finanças. Em famílias com filhos ou diferenças salariais grandes, tributação separada vs conjunta pode diferir em centenas de euros.

**Quando a AT te envia dinheiro:**
Se a retenção durante o ano foi superior ao IRS devido, recebes reembolso (normalmente Junho-Julho). Se pagaste menos, tens de regularizar até 31 de Agosto.

**Checklist final antes de submeter:**
☑ Deduções validadas no e-fatura
☑ Dependentes correctamente identificados
☑ Agregado familiar actualizado (casamento, divórcio, nascimento)
☑ Tributação separada vs conjunta simulada
☑ IBAN actualizado para reembolso
☑ Todas as categorias de rendimento declaradas (trabalho, rendas, capitais, mais-valias)`,
      },
    ],
    quiz: [
      {
        id: 'q1',
        text: 'O IRS em Portugal é calculado como:',
        options: [
          'Uma taxa única sobre o rendimento total',
          'Um imposto progressivo por escalões — a taxa marginal só se aplica à parte do rendimento no escalão',
          'Sempre 23% do rendimento',
          'Um valor fixo por nível salarial',
        ],
        correct: 1,
      },
      {
        id: 'q2',
        text: 'Um trabalhador independente em serviços profissionais factura €20.000/ano. Qual é o rendimento colectável?',
        options: ['€20.000', '€15.000', '€10.000', '€3.000'],
        correct: 1,
      },
      {
        id: 'q3',
        text: 'Até que data deves validar facturas no e-fatura para elas contarem para a declaração?',
        options: ['31 Dezembro', '25 Fevereiro', '30 Junho', '31 Março'],
        correct: 1,
      },
      {
        id: 'q4',
        text: 'Qual é o limite anual de dedução com despesas de saúde?',
        options: ['€250', '€500', '€1.000', 'Sem limite'],
        correct: 2,
      },
      {
        id: 'q5',
        text: 'Qual a regra prática mais importante para trabalhadores independentes?',
        options: [
          'Facturar sempre com IVA',
          'Reservar 30-35% do facturado para IRS e Segurança Social',
          'Nunca pagar PPR',
          'Declarar sempre em tributação conjunta',
        ],
        correct: 1,
      },
    ],
  },

  {
    id:       'psicologia-dinheiro',
    title:    'Psicologia do Dinheiro',
    subtitle: 'Compreende os vieses mentais que sabotam as tuas finanças — e como neutralizá-los',
    emoji:    '🧠',
    color:    'from-rose-600 to-pink-500',
    level:    'Intermédio',
    duration: 32,
    plan:     'premium',
    certificate: {
      title:       'Certificado em Psicologia Financeira',
      description: 'Identifica e neutraliza os principais vieses cognitivos que afectam decisões de gasto, poupança e investimento.',
    },
    lessons: [
      {
        id:       'l1',
        emoji:    '🎭',
        title:    'Dinheiro é emoção antes de ser matemática',
        duration: 8,
        content: `Livros de finanças tratam dinheiro como se fosse uma planilha. Mas decisões financeiras são feitas por humanos — e humanos são emocionais antes de serem racionais.

**O cérebro tem dois sistemas (Kahneman):**
→ **Sistema 1** — Rápido, intuitivo, emocional. Decide a maior parte dos gastos do dia
→ **Sistema 2** — Lento, analítico, esforçado. Só é activado quando forçamos

Quando entras num supermercado com fome, o Sistema 1 domina. Quando fazes orçamento mensal em casa, sabes que podes activar o 2. A questão não é "ser racional" — é **desenhar o ambiente** para que o Sistema 1 falhe menos.

**Princípio fundamental:**
> "As finanças pessoais são mais pessoais do que finanças" — Morgan Housel

Não existe o orçamento óptimo universal. Existe o orçamento que **tu consegues manter**. O mesmo para investimento: a carteira matematicamente óptima é inútil se a abandonas ao primeiro dip de -20%.

**Três verdades inconfortáveis:**
1. Pessoas com iguais salários têm patrimónios muito diferentes — o comportamento pesa mais que o rendimento
2. Há pessoas com doutoramentos em economia que estão arruinadas e motoristas que morrem milionários
3. Mais conhecimento financeiro nem sempre leva a melhores decisões — a emoção contorna o conhecimento`,
      },
      {
        id:       'l2',
        emoji:    '🎪',
        title:    'Os 8 vieses que te drenam a carteira',
        duration: 9,
        content: `Conhecer estes vieses não os elimina — mas permite detectá-los antes de decidirem por ti.

**1. Aversão à perda (Prospect Theory)**
Uma perda de €100 dói 2× mais do que a alegria de ganhar €100. Por isso não vendes acções em queda (esperas "recuperar") e vendes acções em subida cedo demais.

**2. Efeito de ancoragem**
O primeiro preço que vês condiciona toda a percepção. Um relógio de €500 ao lado de um de €2.000 parece barato. O vendedor sabe disso.

**3. Contabilidade mental**
Tratamos dinheiro de forma diferente conforme a origem. €500 do salário são "poupados". €500 de lotaria são "de extra", gastos rapidamente. Na prática, é o mesmo dinheiro.

**4. Viés de confirmação**
Procuras informação que confirma o que já decidiste. Queres comprar tesla? Vais ler análises positivas. Precisas travar-te e **procurar activamente as análises negativas**.

**5. Efeito de manada**
"Toda a gente está a comprar cripto" → compras no topo. "Toda a gente está em pânico" → vendes no fundo. O investimento individual falha no momento exacto em que mais custa.

**6. Viés do presente (Hiperbolic discounting)**
€100 agora parece mais apelativo do que €150 daqui a um ano — apesar de 50% de retorno anual ser excelente. É por isto que poupar dói.

**7. Custo afundado (Sunk cost fallacy)**
"Já gastei €3.000 neste carro, vou gastar mais €2.000 para não perder". Erro: o que já gastaste é irrelevante para a decisão actual.

**8. Excesso de confiança**
80% dos condutores acham-se "acima da média". O mesmo acontece com investidores. A humildade é um edge estatístico.`,
      },
      {
        id:       'l3',
        emoji:    '🎯',
        title:    'Desenhar o ambiente para ganhar',
        duration: 8,
        content: `A força de vontade é um recurso limitado — esgota-se ao longo do dia. Os poupadores consistentes não usam mais força de vontade; **reduzem o número de vezes que precisam dela**.

**Estratégias de arquitectura de escolha:**

**1. Fricção para gastos — facilidade para poupança**
→ Remover cartão do Amazon/1-click → Gastos impulsivos caem 40%
→ Transferência automática da poupança no dia do salário → Poupança sobe 3×
→ Conta de poupança noutro banco sem app no telemóvel → Menos levantamentos

**2. Pré-compromisso**
→ Configurar plano DCA de investimento **antes** de a tentação chegar
→ Assinar uma decisão escrita num momento racional ("vou investir €200/mês em ETF, mesmo se o mercado cair 30%")
→ Falar o objectivo em voz alta a alguém — accountability triplica a taxa de sucesso

**3. Reenquadramento**
→ Ver "€15/dia" de cafés × 300 dias = €4.500/ano → Impacto concreto
→ Calcular subscrições anuais × 10 anos → Netflix a €14/mês = €1.680 em 10 anos
→ Converter preço em "horas de trabalho" → €200 = 20 horas ao salário mínimo

**4. Regras simples em vez de cálculos complexos**
→ "Não compro nada acima de €50 sem dormir 24h" (regra dos 24h)
→ "Poupo 20% de qualquer aumento salarial antes de ajustar estilo de vida"
→ "Revejo investimentos apenas 1× por trimestre" — evita trading emocional

A XP-Money aplica muitas destas ideias: o Score dá feedback imediato (reenquadramento), as missões forçam regras simples, e o mascote adiciona consequência emocional a gastos excessivos.`,
      },
      {
        id:       'l4',
        emoji:    '🌱',
        title:    'Tolerância ao risco — conhece-te primeiro',
        duration: 7,
        content: `Tolerância ao risco tem **duas dimensões**:

**1. Capacidade financeira de suportar risco**
Quanto podes perder sem afectar a vida? Depende de idade, rendimento estável, dependentes, fundo de emergência.

**2. Tolerância emocional ao risco**
Se a carteira cair 30%, consegues dormir? A maioria sobrestima esta tolerância até à primeira crise real.

**O teste de stress honesto:**
Imagina o teu portfólio total hoje. Corta-o a **metade**. Fica só metade. Vais vender tudo em pânico, ou continuas a comprar pelo plano?

Se a resposta é "vendia tudo", a tua carteira está demasiado agressiva. A carteira ideal não é a que maximiza retornos — é a que **consegues manter nos piores momentos**.

**Regra prática:**
→ Nunca investes dinheiro que podes precisar em <3 anos
→ Nunca investes tanto que a volatilidade te impede de dormir
→ Se te foges a olhar para a app do corretor em dias vermelhos, a carteira é agressiva demais

**A pergunta mais importante:**
"Qual é o mínimo que eu **aceito** perder num mau ano?" — Não "qual é o máximo que eu espero ganhar". Os ganhos cuidam de si próprios. As perdas é que destroem carteiras (e saúde mental).

**Concluindo:**
As tuas decisões financeiras não são melhores do que o teu comportamento nos piores dias. Uma carteira "só" com 5% de retorno que consegues manter 30 anos bate uma carteira de 10% que abandonas na primeira crise.

O XP-Money reforça comportamento via o mascote: consistência ganha sempre. Pequenas decisões diárias, mantidas no tempo, constroem património. Grandes decisões impulsivas destroem-no.`,
      },
    ],
    quiz: [
      {
        id: 'q1',
        text: 'Segundo Kahneman, os humanos têm dois sistemas de decisão. Qual toma a maior parte das decisões de gasto diário?',
        options: [
          'Sistema 1 — rápido e emocional',
          'Sistema 2 — lento e analítico',
          'Um sistema híbrido 50/50',
          'Nenhum — as decisões são 100% racionais',
        ],
        correct: 0,
      },
      {
        id: 'q2',
        text: 'O que é a aversão à perda (Prospect Theory)?',
        options: [
          'Evitar qualquer investimento de risco',
          'A dor de perder algo é cerca de 2× maior do que o prazer de ganhar o mesmo valor',
          'Nunca aceitar perdas em acções',
          'Diversificar sempre em vários activos',
        ],
        correct: 1,
      },
      {
        id: 'q3',
        text: 'Qual destas é uma boa estratégia de "arquitectura de escolha"?',
        options: [
          'Ter cartão gravado em todos os sites para comprar rápido',
          'Configurar transferência automática para poupança no dia do salário',
          'Verificar a carteira de investimentos todos os dias',
          'Usar dinheiro vivo apenas em ocasiões especiais',
        ],
        correct: 1,
      },
      {
        id: 'q4',
        text: 'O que é o custo afundado (sunk cost fallacy)?',
        options: [
          'Manter decisões más por causa de dinheiro já gasto que não pode ser recuperado',
          'Gastar mais do que se tem em conta',
          'Investir em activos que vão falir',
          'Calcular mal o retorno de um investimento',
        ],
        correct: 0,
      },
      {
        id: 'q5',
        text: 'Qual é o teste honesto de tolerância ao risco?',
        options: [
          'Imaginar um retorno de +30% e se conseguirias celebrar',
          'Imaginar a carteira a cair 50% — e se continuarias a seguir o plano',
          'Ver o gráfico histórico da última década',
          'Consultar um consultor financeiro',
        ],
        correct: 1,
      },
    ],
  },

  {
    id:       'credito-hipoteca',
    title:    'Crédito e Hipoteca — Guia Essencial',
    subtitle: 'Como avaliar crédito habitação, TAEG, spread e evitar armadilhas em compras a prestações',
    emoji:    '🏠',
    color:    'from-cyan-600 to-teal-500',
    level:    'Intermédio',
    duration: 30,
    plan:     'premium',
    certificate: {
      title:       'Certificado em Crédito e Financiamento',
      description: 'Domina os conceitos de TAN, TAEG, spread, amortização e sabe avaliar propostas de crédito habitação e consumo em Portugal.',
    },
    lessons: [
      {
        id:       'l1',
        emoji:    '📊',
        title:    'TAN, TAEG e spread — o que realmente estás a pagar',
        duration: 7,
        content: `Qualquer crédito tem três taxas. Confundi-las pode custar-te milhares de euros.

**TAN — Taxa Anual Nominal**
É o juro "cru" que o banco cobra sobre o capital em dívida. Em créditos habitação, é composta por:
→ **Indexante** (variável) — Normalmente Euribor a 3/6/12 meses
→ **Spread** (fixo) — A margem do banco. Negociável.

TAN = Euribor + Spread. Se a Euribor a 6 meses está a 3,2% e o spread é 1,0%, a TAN é 4,2%.

**TAEG — Taxa Anual Efectiva Global**
É a taxa que **inclui tudo**: juros, comissões, seguros obrigatórios, impostos. É o único número que realmente te diz o custo total.

**Exemplo real:**
Banco A: TAN 3,5%, TAEG 4,8%
Banco B: TAN 3,8%, TAEG 4,2%

Qual é melhor? **Banco B** — apesar da TAN mais alta, o custo efectivo é menor porque tem menos comissões e seguros mais baratos.

**Sempre compara pela TAEG, nunca pela TAN.** Os bancos às vezes publicitam TAN atractiva e recuperam na TAEG.

**TAER — Taxa Anual Efectiva Revista**
Aparece em créditos variáveis. Simula o custo assumindo que o indexante sobe/desce. É um cenário, não um compromisso.`,
      },
      {
        id:       'l2',
        emoji:    '🏡',
        title:    'Crédito habitação — negociar spread e seguros',
        duration: 8,
        content: `O crédito habitação é a maior decisão financeira da maioria das pessoas. 25-30 anos de compromisso. Cada 0,1% de spread × €200.000 × 30 anos custa **cerca de €3.000**.

**Como negociar spread:**
1. **Pede propostas a 3-5 bancos** em simultâneo (obrigas à concorrência)
2. **Mostra ao banco A a proposta do banco B** — com frequência igualam ou melhoram
3. **Usa intermediários de crédito certificados** — muitas vezes obtêm spreads abaixo dos balcões
4. **Perfis premium** (jovens, profissões reguladas, fidelização) obtêm spreads 0,3-0,6% melhores

**Spread tipico 2025-2026:**
→ Melhor perfil: 0,70-0,90%
→ Perfil médio: 1,00-1,30%
→ Perfil risco: 1,50%+

**Seguros associados — onde perdes dinheiro:**
O banco quase sempre exige:
→ Seguro de vida (obrigatório)
→ Seguro multirriscos habitação (obrigatório)

**Podes fazer estes seguros FORA do banco**. Normalmente poupas **30-50%** no prémio anual. O banco pode tentar condicionar (ex: spread 0,1% mais alto se não fizeres os seguros internamente) — faz as contas:

Poupança no seguro externo: €300/ano
Custo do spread 0,1% maior: €200/ano sobre €200.000
→ Vale a pena ir externo → poupas €100/ano × 30 anos = €3.000

**Taxa de esforço:**
A prestação mensal não deve ultrapassar **35%** do rendimento líquido. Acima disso, qualquer imprevisto (obra no carro, desemprego temporário) entra em crise.`,
      },
      {
        id:       'l3',
        emoji:    '🚗',
        title:    'Compras a prestações — a armadilha escondida',
        duration: 7,
        content: `"Só €49/mês" soa acessível. Mas **€49/mês × 48 meses = €2.352** — para um telemóvel cujo PVP à vista é €1.500.

**O custo real das prestações:**
Vendedores têm incentivo a falar em €/mês porque esconde o custo total. Calcula sempre:

Prestação × nº meses = **Custo total**
Custo total − PVP à vista = **Juros pagos**

**Exemplo — smartphone:**
→ Preço à vista: €1.200
→ 24 prestações de €60 = €1.440
→ Juros: €240 (20% sobre o preço)

Pagaste um telemóvel que custa €1.200 como se custasse €1.440. Para o fabricante, é o mesmo telemóvel.

**Quando faz sentido prestações?**
→ 0% de juro **reais** (verifica na TAEG, não só no "0%" publicitado)
→ Dinheiro livre poderia render mais que a taxa do crédito
→ Emergência — prestação temporária é preferível a não ter o bem essencial

**Quando NÃO faz sentido:**
→ Comprar bens depreciáveis (electrónica, carros) em prestações longas
→ Qualquer TAEG acima de 10%
→ Quando o valor extra faria diferença no orçamento mensal actual
→ Acumular várias prestações em simultâneo (perda de controlo)

**A regra das 3 semanas:**
Antes de assinar prestações acima de €500, espera 3 semanas. A maioria do desejo desaparece. O que permanece é uma decisão ponderada, não impulso.

**Crédito pessoal vs cartão de crédito:**
→ Cartão de crédito: 15-22% TAEG
→ Crédito pessoal: 7-12% TAEG
→ Hipoteca adicional: 4-5% TAEG

Nunca uses o cartão como financiamento a longo prazo. Paga sempre o total mensal.`,
      },
      {
        id:       'l4',
        emoji:    '✂️',
        title:    'Amortizar ou investir? A decisão crítica',
        duration: 8,
        content: `Tens €10.000 extras. Amortizas crédito habitação ou investes? É uma das decisões mais debatidas em finanças pessoais.

**Análise matemática:**
→ Taxa do crédito (TAEG): 4,5%
→ Retorno esperado dos investimentos: 7%
→ Diferença: 2,5% ao ano a favor de investir

**Mas a matemática não é tudo:**

**Argumentos para AMORTIZAR:**
✓ Retorno "garantido" igual à taxa do crédito (4,5% livre de risco)
✓ Reduz risco financeiro em cenários de desemprego
✓ Liberdade psicológica — acabar com dívida trás paz
✓ Reduz o custo total em juros pagos ao banco

**Argumentos para INVESTIR:**
✓ Espera-se retorno histórico superior (7%+ vs 4,5%)
✓ Mantém liquidez — o dinheiro amortizado não volta fácil
✓ Diversificação — não tens todos os "ovos" no imóvel
✓ Ganhos fiscais (benefício PPR, juros menores à dedução)

**A resposta híbrida (mais sensata para a maioria):**
→ **50% amortiza** — reduz capital e torna-o psicologicamente mais leve
→ **50% investe** — mantém exposição a mercados e liquidez

**Quando amortizar definitivamente:**
→ TAEG > 5%
→ Aproxima-se da reforma (baixar compromissos)
→ Perfil muito avesso ao risco

**Quando investir definitivamente:**
→ TAEG < 3%
→ Horizonte de 15+ anos
→ Já tens fundo de emergência + maximizas PPR

**Custos de amortizar em Portugal:**
→ Crédito habitação a taxa fixa: pode ter custo de amortização antecipada até 2%
→ Crédito habitação a taxa variável: custo máximo 0,5% (por lei)
→ Amortizações parciais normalmente reduzem prestação (e/ou prazo)

Simula sempre no banco: "qual é a nova prestação se eu amortizar €10.000 e mantiver o prazo?" vs "qual é o novo prazo se eu amortizar €10.000 e mantiver a prestação?"`,
      },
    ],
    quiz: [
      {
        id: 'q1',
        text: 'Quando comparas propostas de crédito habitação, qual taxa deves usar?',
        options: ['TAN', 'TAEG', 'Euribor', 'Spread isolado'],
        correct: 1,
      },
      {
        id: 'q2',
        text: 'Qual a taxa de esforço máxima recomendada para crédito habitação?',
        options: ['25% do rendimento líquido', '35% do rendimento líquido', '50% do rendimento líquido', 'Sem limite'],
        correct: 1,
      },
      {
        id: 'q3',
        text: 'Um smartphone custa €1.200 à vista ou 24 × €60 = €1.440. Qual é a TAEG aproximada?',
        options: ['0% — é o mesmo preço', 'Cerca de 20%', 'Cerca de 5%', 'Exactamente 10%'],
        correct: 1,
      },
      {
        id: 'q4',
        text: 'Os seguros associados ao crédito habitação:',
        options: [
          'Têm obrigatoriamente de ser feitos no banco que concede o crédito',
          'Podem ser contratados fora do banco — frequentemente com poupanças de 30-50%',
          'Não são obrigatórios',
          'Custam sempre o mesmo em todos os bancos',
        ],
        correct: 1,
      },
      {
        id: 'q5',
        text: 'Quando faz mais sentido amortizar crédito em vez de investir?',
        options: [
          'Sempre — amortizar é sempre melhor',
          'Quando o TAEG do crédito é superior ao retorno esperado dos investimentos',
          'Só depois dos 50 anos',
          'Nunca — investir é sempre melhor',
        ],
        correct: 1,
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
