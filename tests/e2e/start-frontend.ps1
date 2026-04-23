$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
Set-Location $repoRoot

$backendPort = if ($env:E2E_BACKEND_PORT) { $env:E2E_BACKEND_PORT } else { '8002' }
$frontendPort = if ($env:E2E_FRONTEND_PORT) { $env:E2E_FRONTEND_PORT } else { '4174' }

$env:VITE_API_BASE_URL = '/api/v1'
$env:VITE_PROXY_TARGET = "http://127.0.0.1:$backendPort"
$env:E2E_FRONTEND_PORT = $frontendPort
$nodeCmd = (Get-Command node.exe).Source
$pnpmCmd = (Get-Command pnpm.cmd).Source
$serverScript = Join-Path $repoRoot 'tests\e2e\serve-frontend.mjs'

& $pnpmCmd build
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

& $nodeCmd $serverScript
exit $LASTEXITCODE
