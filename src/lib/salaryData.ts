/**
 * Salários médios internacionais para a feature "Se vivesses noutro país"
 * da Perspetiva de Riqueza.
 *
 * Dados: medianas salariais líquidas mensais em EUR, ano de referência 2024.
 * Fontes: OECD Taxing Wages 2024, Eurostat, salaryexplorer.com, Numbeo.
 *
 * `nominalEUR` — valor em euros à taxa de câmbio real, líquido mensal
 *                médio. Útil para comparações absolutas ("ganho 20% do
 *                que ganharia na Alemanha").
 *
 * `pppEUR` — valor ajustado por Purchasing Power Parity (paridade de
 *            poder de compra) usando Portugal como base. Útil para
 *            comparações de qualidade de vida real ("€1000 na Roménia
 *            equivale a €1400 em Portugal").
 *
 * Os PPPs são aproximações — valores ilustrativos, não precisão bancária.
 * Revisar anualmente quando a OECD publica o update.
 */

export type Region = 'europe' | 'north-america' | 'south-america' | 'asia' | 'oceania'

export interface CountryData {
  code:        string   // ISO-2
  flag:        string   // emoji
  name:        string   // pt-PT
  region:      Region
  nominalEUR:  number   // líquido mensal em EUR (câmbio 2024)
  pppEUR:      number   // líquido mensal em EUR equivalente de poder de compra em Portugal
}

export const COUNTRIES: CountryData[] = [
  // Europa Ocidental + Nórdicos
  { code: 'CH', flag: '🇨🇭', name: 'Suíça',            region: 'europe',        nominalEUR: 6240, pppEUR: 4160 },
  { code: 'LU', flag: '🇱🇺', name: 'Luxemburgo',        region: 'europe',        nominalEUR: 4100, pppEUR: 3120 },
  { code: 'NO', flag: '🇳🇴', name: 'Noruega',           region: 'europe',        nominalEUR: 3850, pppEUR: 2950 },
  { code: 'DK', flag: '🇩🇰', name: 'Dinamarca',         region: 'europe',        nominalEUR: 3700, pppEUR: 2820 },
  { code: 'IE', flag: '🇮🇪', name: 'Irlanda',           region: 'europe',        nominalEUR: 3100, pppEUR: 2600 },
  { code: 'DE', flag: '🇩🇪', name: 'Alemanha',          region: 'europe',        nominalEUR: 2980, pppEUR: 2680 },
  { code: 'NL', flag: '🇳🇱', name: 'Países Baixos',     region: 'europe',        nominalEUR: 2780, pppEUR: 2450 },
  { code: 'SE', flag: '🇸🇪', name: 'Suécia',            region: 'europe',        nominalEUR: 2720, pppEUR: 2360 },
  { code: 'AT', flag: '🇦🇹', name: 'Áustria',           region: 'europe',        nominalEUR: 2650, pppEUR: 2380 },
  { code: 'FI', flag: '🇫🇮', name: 'Finlândia',         region: 'europe',        nominalEUR: 2600, pppEUR: 2290 },
  { code: 'GB', flag: '🇬🇧', name: 'Reino Unido',       region: 'europe',        nominalEUR: 2560, pppEUR: 2180 },
  { code: 'BE', flag: '🇧🇪', name: 'Bélgica',           region: 'europe',        nominalEUR: 2500, pppEUR: 2220 },
  { code: 'FR', flag: '🇫🇷', name: 'França',            region: 'europe',        nominalEUR: 2380, pppEUR: 2150 },
  { code: 'IT', flag: '🇮🇹', name: 'Itália',            region: 'europe',        nominalEUR: 1700, pppEUR: 1650 },
  { code: 'ES', flag: '🇪🇸', name: 'Espanha',           region: 'europe',        nominalEUR: 1620, pppEUR: 1780 },
  { code: 'CZ', flag: '🇨🇿', name: 'República Checa',   region: 'europe',        nominalEUR: 1250, pppEUR: 1690 },
  { code: 'PT', flag: '🇵🇹', name: 'Portugal',          region: 'europe',        nominalEUR: 1200, pppEUR: 2000 },
  { code: 'PL', flag: '🇵🇱', name: 'Polónia',           region: 'europe',        nominalEUR: 1180, pppEUR: 1820 },
  { code: 'HU', flag: '🇭🇺', name: 'Hungria',           region: 'europe',        nominalEUR:  950, pppEUR: 1480 },
  { code: 'GR', flag: '🇬🇷', name: 'Grécia',            region: 'europe',        nominalEUR:  900, pppEUR: 1210 },
  { code: 'RO', flag: '🇷🇴', name: 'Roménia',           region: 'europe',        nominalEUR:  890, pppEUR: 1520 },
  { code: 'TR', flag: '🇹🇷', name: 'Turquia',           region: 'europe',        nominalEUR:  820, pppEUR: 1680 },

  // Américas
  { code: 'US', flag: '🇺🇸', name: 'Estados Unidos',    region: 'north-america', nominalEUR: 3520, pppEUR: 3240 },
  { code: 'CA', flag: '🇨🇦', name: 'Canadá',            region: 'north-america', nominalEUR: 2720, pppEUR: 2480 },
  { code: 'MX', flag: '🇲🇽', name: 'México',            region: 'north-america', nominalEUR:  680, pppEUR: 1060 },
  { code: 'BR', flag: '🇧🇷', name: 'Brasil',            region: 'south-america', nominalEUR:  590, pppEUR:  940 },
  { code: 'AR', flag: '🇦🇷', name: 'Argentina',         region: 'south-america', nominalEUR:  720, pppEUR: 1180 },

  // Ásia
  { code: 'JP', flag: '🇯🇵', name: 'Japão',             region: 'asia',          nominalEUR: 2280, pppEUR: 2020 },
  { code: 'KR', flag: '🇰🇷', name: 'Coreia do Sul',     region: 'asia',          nominalEUR: 2080, pppEUR: 1980 },
  { code: 'SG', flag: '🇸🇬', name: 'Singapura',         region: 'asia',          nominalEUR: 3150, pppEUR: 2820 },
  { code: 'CN', flag: '🇨🇳', name: 'China',             region: 'asia',          nominalEUR: 1100, pppEUR: 1760 },
  { code: 'IN', flag: '🇮🇳', name: 'Índia',             region: 'asia',          nominalEUR:  350, pppEUR: 1120 },

  // Oceânia
  { code: 'AU', flag: '🇦🇺', name: 'Austrália',         region: 'oceania',       nominalEUR: 3180, pppEUR: 2780 },
  { code: 'NZ', flag: '🇳🇿', name: 'Nova Zelândia',     region: 'oceania',       nominalEUR: 2580, pppEUR: 2280 },
]

export const REGIONS: Array<{ id: Region | 'all'; label: string }> = [
  { id: 'all',            label: 'Tudo'     },
  { id: 'europe',         label: 'Europa'   },
  { id: 'north-america',  label: 'A. Norte' },
  { id: 'south-america',  label: 'A. Sul'   },
  { id: 'asia',           label: 'Ásia'     },
  { id: 'oceania',        label: 'Oceânia'  },
]

/**
 * Dado o salário líquido mensal do user em EUR, devolve estatísticas
 * comparativas contra a lista de países.
 */
export function computeSalaryStats(userMonthlyEUR: number, mode: 'nominal' | 'ppp') {
  const key = mode === 'nominal' ? 'nominalEUR' : 'pppEUR'
  const sorted = [...COUNTRIES].sort((a, b) => b[key] - a[key])
  const betterThan = sorted.filter(c => c[key] < userMonthlyEUR).length
  const percentile = Math.round((betterThan / sorted.length) * 100)

  // Rank do user se fosse um país
  const rank = sorted.filter(c => c[key] > userMonthlyEUR).length + 1
  const total = sorted.length

  return { sorted, percentile, rank, total, key }
}
