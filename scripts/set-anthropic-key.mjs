#!/usr/bin/env node
/**
 * XP Money — Set Anthropic API key
 * Usage: node scripts/set-anthropic-key.mjs sk-ant-api03-…
 *
 * Gets the key from: https://console.anthropic.com/settings/keys
 */

import { readFileSync, writeFileSync } from 'fs'
import { execSync }  from 'child_process'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { createInterface } from 'readline'

const __dir   = dirname(fileURLToPath(import.meta.url))
const envPath = join(__dir, '..', '.env.local')

const G = '\x1b[32m', Y = '\x1b[33m', B = '\x1b[1m', D = '\x1b[2m', X = '\x1b[0m'

function updateEnv(key, value) {
  let content = readFileSync(envPath, 'utf8')
  const regex = new RegExp(`^${key}=.*$`, 'm')
  if (regex.test(content)) content = content.replace(regex, `${key}=${value}`)
  else content += `\n${key}=${value}\n`
  writeFileSync(envPath, content)
}

async function main() {
  let apiKey = process.argv[2]

  if (!apiKey) {
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    console.log('')
    console.log(`${B}Obtém a tua chave em: https://console.anthropic.com/settings/keys${X}`)
    console.log('')
    apiKey = await new Promise(r => rl.question(`Cole aqui a chave Anthropic (sk-ant-…): `, r))
    rl.close()
  }

  apiKey = apiKey.trim()

  if (!apiKey.startsWith('sk-ant-')) {
    console.error(`${Y}⚠ A chave deve começar com sk-ant-${X}`)
    process.exit(1)
  }

  // 1. Update .env.local
  updateEnv('ANTHROPIC_API_KEY', apiKey)
  console.log(`${G}✓ .env.local atualizado!${X}`)

  // 2. Try Vercel
  console.log('  A adicionar à Vercel…')
  try {
    execSync(`echo "${apiKey}" | npx vercel env add ANTHROPIC_API_KEY production --yes`, {
      stdio: 'pipe', cwd: join(__dir, '..'),
    })
    console.log(`${G}✓ Adicionado à Vercel (produção)!${X}`)
  } catch (_) {
    console.log(`${Y}⚠ Adiciona manualmente em Vercel → Settings → Environment Variables:${X}`)
    console.log(`  ${D}ANTHROPIC_API_KEY = ${apiKey.slice(0,20)}…${X}`)
  }

  console.log('')
  console.log(`${G}${B}✓ Scanner de Faturas com IA pronto!${X}`)
}

main().catch(e => { console.error(e.message); process.exit(1) })
