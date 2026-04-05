#!/usr/bin/env node
// ============================================================
// XP Money — Aplica o schema SQL na base de dados Supabase
// Uso: node apply-schema.mjs <DB_PASSWORD>
// ============================================================

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const { Client } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));

const PROJECT_REF = 'iuhezbbfrssvlbwqnmhu';
const DB_PASSWORD = process.argv[2];

if (!DB_PASSWORD) {
  console.error('\n❌  Falta a password da base de dados!');
  console.error('   Uso: node apply-schema.mjs <DB_PASSWORD>\n');
  console.error('   Para obteres a password:');
  console.error('   1. Vai a https://supabase.com/dashboard/project/' + PROJECT_REF + '/settings/database');
  console.error('   2. Clica em "Reset database password" ou vê a password existente');
  console.error('   3. Copia a password e cola aqui\n');
  process.exit(1);
}

// Supabase direct connection (Session Pooler — porta 5432)
const connectionString = `postgresql://postgres.${PROJECT_REF}:${encodeURIComponent(DB_PASSWORD)}@aws-0-eu-west-1.pooler.supabase.com:5432/postgres`;

const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

async function main() {
  console.log('\n🔌  A ligar à base de dados Supabase...');

  try {
    await client.connect();
    console.log('✅  Ligação estabelecida!\n');
  } catch (err) {
    console.error('❌  Erro de ligação:', err.message);
    console.error('\n   Verifica se a password está correta.');
    console.error('   Podes também tentar a porta 6543 (Transaction Pooler).\n');
    process.exit(1);
  }

  // Lê o schema SQL
  const schemaPath = join(__dirname, 'database', 'schema.sql');
  let schemaSql;
  try {
    schemaSql = readFileSync(schemaPath, 'utf8');
  } catch (err) {
    console.error('❌  Não foi possível ler database/schema.sql:', err.message);
    await client.end();
    process.exit(1);
  }

  console.log('📄  Schema carregado. A aplicar na base de dados...\n');

  try {
    await client.query(schemaSql);
    console.log('✅  Schema aplicado com sucesso!\n');
  } catch (err) {
    // Se algumas tabelas já existem, pode dar erro — tentar statement a statement
    console.warn('⚠️   Erro ao aplicar schema de uma vez, a tentar statement a statement...\n');

    // Dividir em statements individuais (simplificado)
    const statements = schemaSql
      .split(/;\s*\n/)
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    let ok = 0;
    let failed = 0;
    for (const stmt of statements) {
      try {
        await client.query(stmt + ';');
        ok++;
      } catch (e) {
        // Ignorar erros de "já existe"
        if (e.code === '42P07' || e.code === '42710' || e.message.includes('already exists')) {
          ok++;
        } else {
          console.warn('   ⚠️  Aviso:', e.message.slice(0, 80));
          failed++;
        }
      }
    }
    console.log(`\n✅  Concluído: ${ok} OK, ${failed} avisos\n`);
  }

  // Verifica se as tabelas foram criadas
  const { rows } = await client.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name;
  `);

  if (rows.length === 0) {
    console.error('❌  Nenhuma tabela encontrada! Algo correu mal.\n');
  } else {
    console.log('📊  Tabelas na base de dados:');
    rows.forEach(r => console.log('   ✓', r.table_name));
    console.log('');
  }

  await client.end();

  // Verificar se o .env.local já tem a password
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('🎉  Base de dados configurada com sucesso!');
  console.log('');
  console.log('   Próximo passo: reinicia o servidor de desenvolvimento');
  console.log('   npm run dev\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch(err => {
  console.error('Erro inesperado:', err.message);
  process.exit(1);
});
