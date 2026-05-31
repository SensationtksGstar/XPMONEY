/**
 * Shared helpers for deterministic bank-statement parsers.
 *
 * Pure functions, no external deps — safe to unit-test in isolation when
 * real bank samples are eventually obtained. Until then, treat coverage
 * estimates as informed guesses based on the format hints in
 * `lib/ai.ts > buildStatementInstructionsPT`.
 */

/**
 * Parse a date in any common PT/EN format → "YYYY-MM-DD".
 * Returns null on failure (so the caller can skip header rows etc.).
 *
 * Accepts: YYYY-MM-DD · DD-MM-YYYY · DD/MM/YYYY · DD.MM.YYYY · DD-MM-YY
 */
export function parseDate(raw: string): string | null {
  const s = raw.trim()
  if (!s) return null

  // Already YYYY-MM-DD
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (m) {
    const [, y, mo, d] = m
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
  }

  // DD[-/.]MM[-/.]YYYY  or  DD[-/.]MM[-/.]YY
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/)
  if (m) {
    let [, d, mo, y] = m
    if (y.length === 2) y = (parseInt(y, 10) > 50 ? '19' : '20') + y
    const dn = parseInt(d, 10), mn = parseInt(mo, 10)
    if (dn < 1 || dn > 31 || mn < 1 || mn > 12) return null
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
  }

  return null
}

/**
 * Parse a money string (PT or EN format) → { value, sign }.
 * `value` is always positive; `sign` indicates direction.
 * Returns null on failure.
 *
 * Examples:
 *   "1.234,56"     → { value: 1234.56, sign:  1 }
 *   "1234,56"      → { value: 1234.56, sign:  1 }
 *   "1,234.56"     → { value: 1234.56, sign:  1 }
 *   "-50,00"       → { value:   50.00, sign: -1 }
 *   "(50,00)"      → { value:   50.00, sign: -1 }
 *   "50,00 €"      → { value:   50.00, sign:  1 }
 *
 * Heuristic for decimal: whichever of `,` or `.` appears LAST is decimal.
 * Falls back to comma-as-decimal (PT default) when only one is present.
 */
export function parseAmount(raw: string): { value: number; sign: 1 | -1 } | null {
  let s = raw.trim()
  if (!s) return null

  let sign: 1 | -1 = 1
  if (s.startsWith('-') || s.startsWith('−')) { sign = -1; s = s.slice(1).trim() }
  else if (s.startsWith('+'))                  { s = s.slice(1).trim() }
  if (s.startsWith('(') && s.endsWith(')'))    { sign = -1; s = s.slice(1, -1).trim() }

  // Strip currency symbols / ISO codes / surrounding spaces
  s = s
    .replace(/[€$£¥₣]/g, '')
    .replace(/\bEUR\b|\bUSD\b|\bGBP\b/gi, '')
    .replace(/\s+/g, '')
    .trim()

  if (!/^[\d.,]+$/.test(s)) return null

  const lastDot   = s.lastIndexOf('.')
  const lastComma = s.lastIndexOf(',')

  let normalized: string
  if (lastComma > lastDot) {
    normalized = s.replace(/\./g, '').replace(',', '.')
  } else if (lastDot > lastComma) {
    normalized = s.replace(/,/g, '')
  } else {
    normalized = s.replace(',', '.')
  }

  const n = parseFloat(normalized)
  if (!Number.isFinite(n)) return null

  return { value: Math.abs(n), sign }
}

/**
 * Categorise by merchant name. Returns one of the stock category names
 * that already exists in the user's DB (mirror of what the AI prompt asks
 * for in `buildStatementInstructionsPT`). Falls through to "Outros".
 *
 * Income keywords go first because words like "TRANSFERENCIA SALARIO"
 * could otherwise hit the generic "TRANSF" pattern.
 */
export function categorize(description: string, type: 'income' | 'expense'): string {
  const d = description.toUpperCase()

  if (type === 'income') {
    if (/\b(SALARIO|ORDENADO|VENCIMENTO|PROCESSAMENTO\s*SALAR)\b/.test(d)) return 'Salário'
    if (/\b(FREELANC|HONORARI|RECIBO\s*VERDE)\b/.test(d))                  return 'Freelance'
    if (/\b(REEMBOLSO|REEMB[.\s]|RESTITUI[CÇ][AÃ]O\s*IRS|DEVOLU[CÇ][AÃ]O)\b/.test(d)) return 'Reembolsos'
    if (/\b(DIVIDENDO|RENDIMENTO\s*CAPITAIS|JUROS\s*POSITIVOS)\b/.test(d)) return 'Dividendos'
    if (/\b(ARRENDAMENTO|RECEB[.\s].*RENDA|RENDA\s*HABITACAO)\b/.test(d))  return 'Renda'
    if (/\b(VENDA\b|VENDIDO|OLX|VINTED)\b/.test(d))                       return 'Vendas'
    if (/\b(PREMIO|BONUS|GRATIFICAC|LOTARI|EUROMILHOES)\b/.test(d))       return 'Prémios'
    return 'Outros'
  }

  // ── Restaurante (split do antigo "Alimentação")
  if (/\b(MCDONALD|BURGER\s*KING|KFC|TELEPIZZA|PIZZA\s*HUT|STARBUCKS|H3\b|VITAMINAS|TGI|WOK\s*TO\s*WALK)\b/.test(d))           return 'Restaurante'
  if (/\b(CAFE|PASTELARIA|RESTAURANTE|CHURRASQUEIRA|SNACK|TASCA|TASQUINHA|PADARIA)\b/.test(d))                                  return 'Restaurante'
  if (/\b(GLOVO|UBER\s*EATS|BOLT\s*FOOD)\b/.test(d))                                                                            return 'Restaurante'

  // Alimentação — supermercados
  if (/\b(PINGO\s*DOCE|CONTINENTE|LIDL|ALDI|AUCHAN|MERCADONA|INTERMARCH|MINI[\s-]?PRECO|EL\s*CORTE|APOLONIA|JUMBO)\b/.test(d)) return 'Alimentação'

  // Combustível (split do antigo "Transportes")
  if (/\b(GALP|REPSOL|CEPSA|PRIO\b|BP\s|ESTACAO\s*SERVICO|POSTO\s*COMBUST)\b/.test(d)) return 'Combustível'

  // Transportes — rideshare / público / portagens (Combustível já foi acima)
  if (/\b(UBER\b|BOLT\b|FREE\s*NOW|CABIFY|TAXI)\b/.test(d))                            return 'Transporte'
  if (/\b(CP\b|METRO\b|CARRIS|VIVA\s*VIAGEM|PASSE\s*MENSAL|NAVEGANTE|CARRISTUR)\b/.test(d)) return 'Transporte'
  if (/\b(VIA\s*VERDE|PORTAGEM|BRISA|LUSOPONTE|ASCENDI)\b/.test(d))                    return 'Transporte'

  // Subscrições — streaming + recurring digital (split do antigo "Lazer")
  if (/\b(NETFLIX|SPOTIFY|HBO|DISNEY|AMAZON\s*PRIME|YOUTUBE\s*PREMIUM|APPLE\.COM\/BILL|APPLE\s*MUSIC|TIDAL|DEEZER|ICLOUD)\b/.test(d)) return 'Subscrições'
  if (/\b(GOOGLE\s*ONE|MICROSOFT\s*365|OFFICE\s*365|ADOBE|CANVA|NOTION|FIGMA|DROPBOX)\b/.test(d))                                     return 'Subscrições'
  if (/\b(GINASIO|FITNESS|FITUP|HOLMES\s*PLACE|VIVA\s*GYM|SOLINCA|VITAL\s*BODY)\b/.test(d))                                            return 'Subscrições'

  // Lazer — entretenimento pontual
  if (/\b(CINEMA|NOS\s*CINEMAS|UCI\b|TEATRO|FNAC\s*LIVE|TICKETLINE|BLUETICKET|CASINO)\b/.test(d))                              return 'Lazer'
  if (/\b(STEAM\b|PLAYSTATION|XBOX|NINTENDO|EPIC\s*GAMES)\b/.test(d))                                                          return 'Lazer'

  // Viagens
  if (/\b(TAP\b|RYANAIR|EASYJET|VUELING|LUFTHANSA|BOOKING|AIRBNB|EXPEDIA|HOTEL\b|POUSADA|RESORT)\b/.test(d)) return 'Viagens'

  // Casa — utilities + renda (despesa)
  if (/\b(EDP|GALP\s*POWER|GOLDENERGY|IBERDROLA|ENDESA)\b/.test(d))                    return 'Casa'
  if (/\b(MEO\b|NOS\b|VODAFONE|NOWO|MEO\s*FIBRA|DIGI\b)\b/.test(d))                    return 'Casa'
  if (/\b(AGUAS\s*DE|EPAL|SMAS|INDAQUA|VEOLIA)\b/.test(d))                              return 'Casa'
  if (/\b(RENDA\b|CONDOMINIO|IMOBILIAR)\b/.test(d))                                     return 'Casa'
  if (/\b(IKEA|LEROY\s*MERLIN|AKI\b|BRICODEPOT)\b/.test(d))                            return 'Casa'

  // Serviços (técnicos / profissionais)
  if (/\b(CANALIZ|ELECTRICIST|MECANIC|REPARAC|MUDANCAS|LIMPEZA|JARDINAGEM)\b/.test(d)) return 'Serviços'
  if (/\b(NOTARIO|ADVOGADO|CONTABILIST|CONSULTOR)\b/.test(d))                          return 'Serviços'

  // Seguros
  if (/\b(SEGUROS?\b|TRANQUILIDADE|FIDELIDADE|ZURICH|ALLIANZ|GENERALI|LIBERTY\s*SEG|MAPFRE|AGEAS)\b/.test(d)) return 'Seguros'

  // Impostos
  if (/\b(AT\s+|FINANCAS|IUC\b|IMI\b|IRS\b|SS\s+|SEGURANCA\s+SOCIAL|DGCI|IGSS)\b/.test(d)) return 'Impostos'

  // Animais
  if (/\b(VETERINARI|PETSHOP|PET\s*SHOP|ZOOMARK|ROYAL\s*CANIN|PURINA)\b/.test(d)) return 'Animais'

  // Saúde
  if (/\b(FARMACIA|PHARMACIE|BENU|HOLON\b)\b/.test(d))                                  return 'Saúde'
  if (/\b(CLINICA|HOSPITAL|MEDICO|DENTIS|LUSIADAS|CUF\b|TROFA\s*SAUDE|MULTIOPTICAS)\b/.test(d)) return 'Saúde'

  // Tech / electronics
  if (/\b(WORTEN|FNAC\b|MEDIAMARKT|PCDIGA|PCSTORE|RADIO\s*POPULAR|GLOBALDATA)\b/.test(d)) return 'Tecnologia'
  if (/\b(AMAZON\b|EBAY|ALIEXPRESS)\b/.test(d))                                            return 'Tecnologia'

  // Clothes
  if (/\b(ZARA|H&M|MASSIMO\s*DUTTI|MANGO|PRIMARK|DECATHLON|SPORT\s*ZONE|NIKE|ADIDAS|PULL\s*BEAR|BERSHKA|STRADIVARIUS)\b/.test(d)) return 'Roupas'

  // Education
  if (/\b(UNIVERSIDAD|FACULDADE|ESCOLA|FORMACAO|UDEMY|COURSERA)\b/.test(d)) return 'Educação'

  return 'Outros'
}

/**
 * Strip noisy prefixes that PT banks shove in front of every description.
 * "COMPRA EM PINGO DOCE LISBOA" → "PINGO DOCE LISBOA"
 * Capped at 80 chars so the UI table cell doesn't overflow.
 */
export function cleanDescription(raw: string): string {
  return raw
    .replace(/^(COMPRA\s+(EM\s+)?|TRF\s+(SEPA\s+)?|TRANSF\s+|TRANSFERENCIA\s+|PAGAMENTO\s+|PG\s+|DD\s+|DEB[\s.]*DIRECTO\s+|MB\s+|MBWAY\s+|LEV\s+ATM\s+)/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
}

/**
 * Quick fingerprint check — does the file content look like it could be
 * from this bank? Used by each parser's `detect()` before any heavy
 * regex matching.
 */
export function hasAny(text: string, ...patterns: RegExp[]): boolean {
  return patterns.some(p => p.test(text))
}

/**
 * Split a CSV line, respecting quoted fields. PT bank exports often
 * quote the description column because it can contain semicolons.
 */
export function splitCsvLine(line: string, sep: ';' | ',' | '\t'): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === sep && !inQuotes) {
      out.push(cur); cur = ''
    } else {
      cur += ch
    }
  }
  out.push(cur)
  return out.map(s => s.trim().replace(/^"(.*)"$/, '$1'))
}
