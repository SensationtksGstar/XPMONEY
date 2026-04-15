#!/usr/bin/env node
/**
 * XP Money — One-time setup assistant
 * Run: npm run setup
 */

import { createInterface }  from 'readline'
import { readFileSync, writeFileSync } from 'fs'
import { execSync, spawn } from 'child_process'
import { fileURLToPath }   from 'url'
import { dirname, join }   from 'path'

const __dir   = dirname(fileURLToPath(import.meta.url))
const root    = join(__dir, '..')
const envPath = join(root, '.env.local')

const GREEN  = '\x1b[32m'
const YELLOW = '\x1b[33m'
const CYAN   = '\x1b[36m'
const BOLD   = '\x1b[1m'
const DIM    = '\x1b[2m'
const RED    = '\x1b[31m'
const RESET  = '\x1b[0m'

const green  = s => GREEN + s + RESET
const yellow = s => YELLOW + s + RESET
const cyan   = s => CYAN + s + RESET
const bold   = s => BOLD + s + RESET
const dim    = s => DIM + s + RESET
const red    = s => RED + s + RESET

function print(msg = '') { process.stdout.write(msg + '\n') }

function question(rl, prompt) {
  return new Promise(resolve => rl.question(prompt, resolve))
}

function updateEnv(key, value) {
  let content = readFileSync(envPath, 'utf8')
  const regex = new RegExp(`^${key}=.*$`, 'm')
  if (regex.test(content)) {
    content = content.replace(regex, `${key}=${value}`)
  } else {
    content += `\n${key}=${value}\n`
  }
  writeFileSync(envPath, content)
}

function openBrowser(url) {
  try {
    const p = process.platform
    if (p === 'win32')  execSync(`start "" "${url}"`,  { stdio: 'ignore' })
    else if (p === 'darwin') execSync(`open "${url}"`, { stdio: 'ignore' })
    else execSync(`xdg-open "${url}"`,                 { stdio: 'ignore' })
  } catch (_) {}
}

async function callSetupApi(dbPassword) {
  const res = await fetch('http://localhost:3000/api/admin/setup-db', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'x-setup-secret': 'XPMONEY_SETUP' },
    body:    JSON.stringify({ dbPassword }),
  })
  return res.json()
}

async function isServerRunning() {
  try {
    const r = await fetch('http://localhost:3000/api/health', { signal: AbortSignal.timeout(2000) })
    return r.ok
  } catch {
    try {
      await fetch('http://localhost:3000', { signal: AbortSignal.timeout(2000) })
      return true
    } catch { return false }
  }
}

async function main() {
  const rl = createInterface({ input: process.stdin, output: process.stdout })

  print('')
  print(bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'))
  print(bold('   XP Money — Setup Assistant  🚀              '))
  print(bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'))
  print('')

  // ── STEP 1: Supabase table via API ──────────────────────────
  print(bold('📦 PASSO 1 — Criar tabela Supabase (goal_deposits)'))
  print('')
  print('  A verificar se o servidor está a correr…')

  const running = await isServerRunning()
  let serverProcess = null

  if (!running) {
    print('  ' + yellow('Servidor offline — a iniciar npm run dev…'))
    serverProcess = spawn('npm', ['run', 'dev'], { cwd: root, stdio: 'ignore', detached: true })
    serverProcess.unref()
    print('  Aguarda 5 segundos…')
    await new Promise(r => setTimeout(r, 5000))
  } else {
    print('  ' + green('✓ Servidor online em localhost:3000'))
  }

  print('')
  print('  Abre o Supabase Dashboard e copia a password da base de dados:')
  openBrowser('https://supabase.com/dashboard/project/iuhezbbfrssvlbwqnmhu/settings/database')
  print('  ' + dim('(abrindo Supabase → Settings → Database → Database password)'))
  print('')
  print('  ' + cyan('Se não encontrares, clica em "Reset database password" para gerar uma nova.'))
  print('')

  let dbOk = false
  while (!dbOk) {
    const pw = (await question(rl, '  Cole aqui a DB password do Supabase: ')).trim()
    if (!pw) { print('  ' + yellow('⚠ Password vazia, tenta novamente.')); continue }

    print('  A criar a tabela…')
    try {
      const result = await callSetupApi(pw)
      if (result.success) {
        print('  ' + green('✓ Tabela goal_deposits criada com sucesso!'))
        dbOk = true
      } else {
        print('  ' + red('✗ Falhou: ' + (result.error || 'erro desconhecido')))
        if (result.details) result.details.forEach(d => print('    ' + dim(d)))
        print('')
        print('  ' + yellow('Alternativa: cola o SQL manualmente no Supabase SQL Editor:'))
        openBrowser('https://supabase.com/dashboard/project/iuhezbbfrssvlbwqnmhu/sql/new')
        print('')
        const sql = readFileSync(join(__dir, 'migrate.sql'), 'utf8')
        sql.split('\n').forEach(l => print('  ' + dim(l)))
        print('')
        await question(rl, '  Pressiona ENTER depois de executar o SQL… ')
        dbOk = true
      }
    } catch (err) {
      print('  ' + red('✗ Servidor não respondeu. Garante que npm run dev está a correr.'))
      print('  ' + dim(String(err).slice(0, 80)))
    }
  }

  print('')

  // ── STEP 2: Anthropic API key ────────────────────────────────
  print(bold('🤖 PASSO 2 — Chave Anthropic (Scanner de Faturas com IA)'))
  print('')

  // Check if already configured
  const currentEnv  = readFileSync(envPath, 'utf8')
  const existingKey = currentEnv.match(/^ANTHROPIC_API_KEY=(sk-ant-[^\s]+)/m)?.[1]

  if (existingKey) {
    print('  ' + green(`✓ Chave já configurada: ${existingKey.slice(0, 20)}…`))
  } else {
    print('  A abrir o Anthropic Console…')
    openBrowser('https://console.anthropic.com/settings/keys')
    print('  ' + dim('  1. Clica "Create Key"  →  Nome: "XP Money"'))
    print('  ' + dim('  2. Copia a chave (começa com sk-ant-api03-…)'))
    print('')

    let apiKey = ''
    while (!apiKey.startsWith('sk-ant-')) {
      apiKey = (await question(rl, '  Cole aqui a chave Anthropic: ')).trim()
      if (!apiKey.startsWith('sk-ant-')) {
        print('  ' + yellow('⚠ Deve começar com sk-ant-  Tenta novamente.'))
      }
    }

    updateEnv('ANTHROPIC_API_KEY', apiKey)
    print('  ' + green('✓ .env.local atualizado!'))

    // Add to Vercel
    print('  A adicionar à Vercel (produção)…')
    try {
      execSync(`echo "${apiKey}" | npx vercel env add ANTHROPIC_API_KEY production`, {
        stdio: 'pipe', cwd: root,
      })
      print('  ' + green('✓ Variável adicionada à Vercel!'))
    } catch (_) {
      print('  ' + yellow('⚠ Adiciona manualmente em Vercel → Settings → Environment Variables'))
      print('  ' + dim(`  ANTHROPIC_API_KEY = ${apiKey.slice(0, 20)}…`))
    }
  }

  // ── DONE ─────────────────────────────────────────────────────
  print('')
  print(bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'))
  print(bold(green('   ✓ Setup completo!')))
  print(bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'))
  print('')
  print('  Próximos passos:')
  print('  1. ' + cyan('npm run dev') + '        — testar localmente')
  print('  2. ' + cyan('npx vercel --prod') + '  — deploy para produção')
  print('')

  rl.close()
  process.exit(0)
}

main().catch(err => { console.error(err); process.exit(1) })
