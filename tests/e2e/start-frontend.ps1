$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
Set-Location $repoRoot

$env:VITE_API_BASE_URL = '/api/v1'
$env:VITE_PROXY_TARGET = 'http://127.0.0.1:8001'
$nodeCmd = (Get-Command node.exe).Source
$pnpmCmd = (Get-Command pnpm.cmd).Source
$serverScript = Join-Path $repoRoot 'tests\e2e\serve-frontend.mjs'

& $pnpmCmd build
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

& $nodeCmd $serverScript
exit $LASTEXITCODE
