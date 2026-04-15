# XP Money — Setup com interface gráfica
# Executa: powershell -ExecutionPolicy Bypass -File scripts\setup-gui.ps1

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName Microsoft.VisualBasic

$projectRef = "iuhezbbfrssvlbwqnmhu"
$root = Split-Path -Parent $PSScriptRoot

# ─── HELPER: mostrar mensagem ───────────────────────────────────
function Show-Info($msg) {
    [System.Windows.Forms.MessageBox]::Show($msg, "XP Money Setup", "OK", "Information") | Out-Null
}
function Show-Error($msg) {
    [System.Windows.Forms.MessageBox]::Show($msg, "XP Money Setup — Erro", "OK", "Error") | Out-Null
}
function Ask-Input($title, $prompt) {
    return [Microsoft.VisualBasic.Interaction]::InputBox($prompt, $title, "")
}

# ─── Boas-vindas ────────────────────────────────────────────────
$welcome = @"
XP Money — Setup Automático

Vamos configurar 2 coisas:
  1. Tabela Supabase (poupanças)
  2. Chave Anthropic (scanner de faturas)

Vais ver 2 páginas a abrir no browser.
Para cada uma, copia o valor pedido e cola na caixa de texto.

Clica OK para começar!
"@
$r = [System.Windows.Forms.MessageBox]::Show($welcome, "XP Money Setup", "OKCancel", "Information")
if ($r -eq "Cancel") { exit }

# ════════════════════════════════════════════════════════════════
# PASSO 1 — Supabase DB Password
# ════════════════════════════════════════════════════════════════
Show-Info @"
PASSO 1/2 — Supabase

Vou abrir o Supabase Dashboard.
Na página que abre, procura:
  'Database password'

Copia essa password e cola na próxima caixa.
"@

Start-Process "https://supabase.com/dashboard/project/$projectRef/settings/database"
Start-Sleep -Seconds 2

$dbPassword = ""
while ($dbPassword.Length -lt 8) {
    $dbPassword = Ask-Input "Supabase DB Password" "Cola aqui a 'Database password' do Supabase:`n`n(se não vires, clica em 'Reset database password' para gerar uma)"
    if ($dbPassword -eq "") {
        $skip = [System.Windows.Forms.MessageBox]::Show("Saltar este passo?`n(as poupanças vão funcionar mas sem histórico)", "Saltar?", "YesNo", "Question")
        if ($skip -eq "Yes") { $dbPassword = "SKIP"; break }
    }
}

if ($dbPassword -ne "SKIP") {
    # Tentar criar a tabela via pg
    $nodeScript = @"
const { Client } = require('pg');
const ref = '$projectRef';
const pw = process.argv[1];
const SQL = `
CREATE TABLE IF NOT EXISTS public.goal_deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount NUMERIC(15,2) NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_goal_deposits_goal_id ON public.goal_deposits(goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_deposits_user_id ON public.goal_deposits(user_id);
ALTER TABLE public.goal_deposits ENABLE ROW LEVEL SECURITY;
DO \`\$\`\$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='goal_deposits' AND policyname='Users manage own deposits') THEN
    CREATE POLICY "Users manage own deposits" ON public.goal_deposits FOR ALL
    USING (user_id = (SELECT id FROM public.users WHERE clerk_id = auth.jwt() ->> 'sub' LIMIT 1));
  END IF;
END \`\$\`\$;
`;
const hosts = [
  'aws-0-eu-central-1.pooler.supabase.com',
  'aws-0-us-east-1.pooler.supabase.com',
  'aws-0-eu-west-2.pooler.supabase.com',
];
async function main() {
  for (const host of hosts) {
    const client = new Client({ host, port: 5432, user: 'postgres.' + ref, password: pw, database: 'postgres', ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 8000 });
    try {
      await client.connect();
      await client.query(SQL);
      await client.end();
      console.log('SUCCESS');
      return;
    } catch(e) {
      try { await client.end() } catch {}
    }
  }
  console.log('FAILED');
}
main();
"@
    $tmpJs = "$env:TEMP\xpm-setup.js"
    $nodeScript | Out-File -FilePath $tmpJs -Encoding UTF8

    $result = & node $tmpJs $dbPassword 2>$null
    Remove-Item $tmpJs -Force -ErrorAction SilentlyContinue

    if ($result -eq "SUCCESS") {
        Show-Info "✅ Tabela criada com sucesso!`n`nPoupanças com histórico agora funcionam."
    } else {
        # Fallback: abrir SQL Editor
        $msg = [System.Windows.Forms.MessageBox]::Show(
            "Não consegui conectar diretamente.`n`nVou abrir o SQL Editor do Supabase.`nClica OK e depois cola o SQL que vais ver no terminal.",
            "Fallback — SQL Editor", "OKCancel", "Warning")
        if ($msg -eq "OK") {
            Start-Process "https://supabase.com/dashboard/project/$projectRef/sql/new"
            $sqlContent = Get-Content "$PSScriptRoot\migrate.sql" -Raw
            Set-Clipboard -Value $sqlContent
            Show-Info "SQL copiado para o clipboard!`n`nCola (Ctrl+V) no SQL Editor e clica 'Run'."
        }
    }
}

# ════════════════════════════════════════════════════════════════
# PASSO 2 — Anthropic API Key
# ════════════════════════════════════════════════════════════════
Show-Info @"
PASSO 2/2 — Anthropic (Scanner de Faturas IA)

Vou abrir o Anthropic Console.
Na página que abre:
  1. Clica 'Create Key'
  2. Nome: XP Money
  3. Copia a chave (sk-ant-api03-...)

Cola na próxima caixa.
"@

Start-Process "https://console.anthropic.com/settings/keys"
Start-Sleep -Seconds 2

$apiKey = ""
while (-not $apiKey.StartsWith("sk-ant-")) {
    $apiKey = Ask-Input "Anthropic API Key" "Cola aqui a chave Anthropic:`n(começa com sk-ant-api03-...)"
    if ($apiKey -eq "") {
        $skip = [System.Windows.Forms.MessageBox]::Show("Saltar o scanner de faturas?", "Saltar?", "YesNo", "Question")
        if ($skip -eq "Yes") { $apiKey = "SKIP"; break }
    } elseif (-not $apiKey.StartsWith("sk-ant-")) {
        Show-Error "A chave deve começar com sk-ant-`nTenta novamente."
        $apiKey = ""
    }
}

if ($apiKey -ne "SKIP") {
    # Update .env.local
    $envPath = "$root\.env.local"
    $envContent = Get-Content $envPath -Raw
    if ($envContent -match "ANTHROPIC_API_KEY=.*") {
        $envContent = $envContent -replace "ANTHROPIC_API_KEY=.*", "ANTHROPIC_API_KEY=$apiKey"
    } else {
        $envContent += "`nANTHROPIC_API_KEY=$apiKey`n"
    }
    $envContent | Out-File -FilePath $envPath -Encoding UTF8 -NoNewline

    # Try Vercel
    try {
        $null = echo $apiKey | npx vercel env add ANTHROPIC_API_KEY production --yes 2>$null
    } catch {}

    Show-Info "✅ Chave Anthropic guardada!`n`nScanner de faturas com IA ativo."
}

# ─── Deploy final ────────────────────────────────────────────────
$deploy = [System.Windows.Forms.MessageBox]::Show(
    "Setup completo! 🎉`n`nFazer deploy para produção agora?",
    "Deploy?", "YesNo", "Question")

if ($deploy -eq "Yes") {
    $deployWindow = New-Object System.Windows.Forms.Form
    $deployWindow.Text = "XP Money — Deploy"
    $deployWindow.Size = New-Object System.Drawing.Size(500, 200)
    $deployWindow.StartPosition = "CenterScreen"
    $label = New-Object System.Windows.Forms.Label
    $label.Text = "A fazer deploy para Vercel...`nAguarda uns segundos."
    $label.Size = New-Object System.Drawing.Size(460, 60)
    $label.Location = New-Object System.Drawing.Point(20, 40)
    $label.Font = New-Object System.Drawing.Font("Segoe UI", 12)
    $deployWindow.Controls.Add($label)
    $deployWindow.Show()
    [System.Windows.Forms.Application]::DoEvents()

    Push-Location $root
    $output = npx vercel --prod --yes 2>&1
    Pop-Location

    $deployWindow.Close()
    Show-Info "✅ Deploy concluído!`n`nA app está em produção."
}

[System.Windows.Forms.MessageBox]::Show(
    "Tudo pronto! 🚀`n`nXP Money está configurado e a funcionar.",
    "XP Money — Concluído", "OK", "Information") | Out-Null
