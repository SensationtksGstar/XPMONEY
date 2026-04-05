// =====================================================
// XP MONEY — Setup Automático
// Corre com: node setup.mjs
// =====================================================
import { createInterface } from 'readline'
import { readFileSync, writeFileSync } from 'fs'

const rl = createInterface({ input: process.stdin, output: process.stdout })
const ask  = (q)       => new Promise(r => rl.question(q, r))
const askH = (q)       => new Promise(r => {
  process.stdout.write(q)
  process.stdin.setRawMode?.(true)
  let hidden = ''
  process.stdin.resume()
  process.stdin.setEncoding('utf8')
  const onData = (ch) => {
    if (ch === '\n' || ch === '\r') {
      process.stdin.setRawMode?.(false)
      process.stdin.removeListener('data', onData)
      process.stdout.write('\n')
      r(hidden)
    } else if (ch === '\u0003') {
      process.exit()
    } else {
      hidden += ch
      process.stdout.write('*')
    }
  }
  process.stdin.on('data', onData)
})

const G = '\x1b[32m', Y = '\x1b[33m', R = '\x1b[31m', C = '\x1b[36m', B = '\x1b[1m', X = '\x1b[0m'
const ok    = m => console.log(`${G}✓${X} ${m}`)
const warn  = m => console.log(`${Y}!${X} ${m}`)
const err   = m => console.log(`${R}✗${X} ${m}`)
const title = m => console.log(`\n${B}${C}── ${m} ──${X}\n`)
const log   = m => console.log(m)

async function applySchema(url, serviceKey) {
  // Supabase Management API — executa SQL directamente
  const projectRef = url.replace('https://', '').replace('.supabase.co', '')
  const schema = readFileSync('./database/schema.sql', 'utf-8')

  // Dividir em statements individuais e executar via REST
  const stmts = schema
    .replace(/--.*$/gm, '')          // remove comentários
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 5)

  let applied = 0
  for (const stmt of stmts) {
    try {
      const res = await fetch(`https://${projectRef}.supabase.co/rest/v1/`, {
        method: 'POST',
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
      })
      applied++
    } catch { /* best effort */ }
  }

  // Método principal: usar o endpoint de SQL do Supabase
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: schema }),
  })

  if (res.ok) return true

  // Fallback: tentar via pg endpoint
  const res2 = await fetch(`https://${projectRef}.supabase.co/pg/query`, {
    method: 'POST',
    headers: {
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: schema }),
  })

  return res2.ok
}

async function verifySchema(url, serviceKey) {
  const { createClient } = await import('@supabase/supabase-js')
  const db = createClient(url, serviceKey, { auth: { persistSession: false } })
  const { error } = await db.from('users').select('id').limit(1)
  return !error || error.code !== '42P01' // 42P01 = table not found
}

async function main() {
  console.clear()
  log(`\n${B}╔══════════════════════════════════════╗`)
  log(`║      XP MONEY — Setup Automático     ║`)
  log(`╚══════════════════════════════════════╝${X}\n`)
  log('Vamos configurar a tua base de dados em ~5 minutos.\n')

  // ══════════════════════════════════════
  title('PASSO 1 de 2 — Criar projeto Supabase')
  // ══════════════════════════════════════
  log(`${Y}Faz isto agora (abre uma nova janela do browser):${X}`)
  log('')
  log(`  1. Vai a ${B}https://app.supabase.com${X}`)
  log('  2. Clica em "New project"')
  log('  3. Nome do projeto: xpmoney')
  log('  4. Região: escolhe EU (West EU Ireland)')
  log('  5. Password: qualquer coisa forte')
  log('  6. Clica "Create new project"')
  log(`  7. ${Y}Espera até ver "Project is ready" (~2 min)${X}`)

  await ask(`\n${G}Quando estiver pronto, prime ENTER...${X}`)

  // ══════════════════════════════════════
  title('PASSO 2 de 2 — Copiar as chaves')
  // ══════════════════════════════════════
  log('No Supabase, vai a:')
  log(`  ${B}Settings → API${X}  (menu esquerdo, ícone ⚙️)\n`)
  log('Vais ver 3 valores que precisamos:\n')

  log(`${C}Project URL${X} — começa com https://`)
  const supaUrl = (await ask('  Cola aqui → ')).trim()

  log(`\n${C}anon public${X} — começa com eyJ (em "Project API keys")`)
  const anonKey = (await ask('  Cola aqui → ')).trim()

  log(`\n${C}service_role${X} — começa com eyJ (clica "Reveal" para ver)`)
  const svcKey  = (await ask('  Cola aqui → ')).trim()

  // Validação básica
  if (!supaUrl.includes('supabase.co')) {
    err('URL inválido. Deve ser algo como https://abcxyz.supabase.co')
    process.exit(1)
  }
  if (!anonKey.startsWith('eyJ') || !svcKey.startsWith('eyJ')) {
    err('Chaves inválidas. Devem começar com eyJ')
    process.exit(1)
  }
  ok('Chaves Supabase recebidas!')

  // ══════════════════════════════════════
  title('A aplicar a base de dados...')
  // ══════════════════════════════════════

  // Atualizar .env.local PRIMEIRO para poder usar o cliente
  let env = readFileSync('./.env.local', 'utf-8')
  env = env
    .replace(/NEXT_PUBLIC_SUPABASE_URL=.*/,     `NEXT_PUBLIC_SUPABASE_URL=${supaUrl}`)
    .replace(/NEXT_PUBLIC_SUPABASE_ANON_KEY=.*/, `NEXT_PUBLIC_SUPABASE_ANON_KEY=${anonKey}`)
    .replace(/SUPABASE_SERVICE_ROLE_KEY=.*/,     `SUPABASE_SERVICE_ROLE_KEY=${svcKey}`)
  writeFileSync('./.env.local', env, 'utf-8')
  ok('.env.local atualizado!')

  // Tentar aplicar schema automaticamente
  log('\nA tentar aplicar o schema automaticamente...')
  let schemaApplied = false
  try {
    schemaApplied = await applySchema(supaUrl, svcKey)
  } catch { /* ignorar */ }

  if (schemaApplied) {
    ok('Schema aplicado automaticamente!')
  } else {
    // Método manual — abrir o ficheiro
    warn('Não foi possível aplicar o schema automaticamente.')
    log('\nFaz isto (1 minuto):')
    log(`  1. No Supabase, clica em ${B}"SQL Editor"${X} (menu esquerdo)`)
    log(`  2. Clica em ${B}"New query"${X}`)
    log(`  3. Abre este ficheiro no Notepad:`)
    log(`     ${B}C:\\Users\\HP\\Desktop\\XPMONEY\\database\\schema.sql${X}`)
    log('  4. Seleciona tudo (Ctrl+A), copia (Ctrl+C)')
    log('  5. Cola no SQL Editor do Supabase (Ctrl+V)')
    log(`  6. Clica ${B}"Run"${X} (botão verde no canto inferior direito)`)

    // Abrir o ficheiro automaticamente
    try {
      const { execSync } = await import('child_process')
      execSync('notepad "C:\\Users\\HP\\Desktop\\XPMONEY\\database\\schema.sql"', { stdio: 'ignore' })
      ok('Ficheiro schema.sql aberto no Notepad!')
    } catch { warn('Abre o ficheiro manualmente no Notepad.') }

    await ask(`\n${G}Quando tiveres clicado "Run" no Supabase, prime ENTER...${X}`)
  }

  // Verificar schema
  log('\nA verificar a base de dados...')
  try {
    const ok2 = await verifySchema(supaUrl, svcKey)
    if (ok2) {
      ok('Base de dados verificada e pronta!')
    } else {
      warn('Não consegui verificar. O schema pode ainda não ter sido aplicado.')
      warn('Se tiveres erros ao usar a app, verifica o Supabase SQL Editor.')
    }
  } catch (e) {
    warn('Erro ao verificar: ' + e.message)
  }

  // ══════════════════════════════════════
  title('✅ TUDO PRONTO!')
  // ══════════════════════════════════════
  log(`${G}${B}A tua app XP Money está configurada!${X}\n`)
  log('O servidor vai reiniciar para carregar as novas chaves.')
  log('')
  log(`Depois disso:`)
  log(`  1. Vai a ${B}http://localhost:3000/sign-up${X}`)
  log('  2. Cria a tua conta com email ou Google')
  log('  3. Completa o onboarding (3 passos)')
  log(`  4. ${G}Começa a usar o XP Money! 🚀${X}`)
  log('')

  rl.close()

  // Reiniciar servidor Next.js
  log('A reiniciar o servidor...\n')
  try {
    const { execSync } = await import('child_process')
    // Matar processo na porta 3000
    try { execSync('cmd /c "for /f "tokens=5" %a in (\'netstat -aon ^| find ":3000"\') do taskkill /f /pid %a"', { stdio: 'ignore' }) } catch {}
    // Aguardar e relançar
    await new Promise(r => setTimeout(r, 1500))
    execSync('start cmd /k "cd /d C:\\Users\\HP\\Desktop\\XPMONEY && npm run dev"', { stdio: 'ignore' })
    ok('Servidor reiniciado! Abre http://localhost:3000')
  } catch {
    warn('Reinicia o servidor manualmente: npm run dev')
  }
}

main().catch(e => {
  err('Erro: ' + e.message)
  rl.close()
  process.exit(1)
})
