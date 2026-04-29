$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
Set-Location $repoRoot

$backendPort = if ($env:E2E_BACKEND_PORT) { $env:E2E_BACKEND_PORT } else { '8002' }
$frontendPort = if ($env:E2E_FRONTEND_PORT) { $env:E2E_FRONTEND_PORT } else { '4174' }
$distDir = Join-Path $repoRoot 'dist-e2e'

$env:VITE_API_BASE_URL = '/api/v1'
$env:VITE_PROXY_TARGET = "http://127.0.0.1:$backendPort"
$env:E2E_FRONTEND_PORT = $frontendPort
$env:E2E_DIST_DIR = $distDir
$nodeCmd = (Get-Command node.exe).Source
$pnpmCmd = (Get-Command pnpm.cmd).Source
$serverScript = Join-Path $repoRoot 'tests\e2e\serve-frontend.mjs'

if (Test-Path $distDir) {
  Remove-Item -LiteralPath $distDir -Recurse -Force
}

& $pnpmCmd exec vite build --outDir $distDir
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

& $nodeCmd $serverScript
exit $LASTEXITCODE
