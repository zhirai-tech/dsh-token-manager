# Install (or refresh) the plugin into an isolated DSH profile for testing.
# Usage: powershell -ExecutionPolicy Bypass -File scripts\install-sandbox.ps1 [-Profile tm-sandbox] [-Port 62300]
param(
  [string]$Profile = 'tm-sandbox',
  [int]$Port = 62300
)
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $root

Write-Host '[1/4] building...'
npm run build
if ($LASTEXITCODE -ne 0) { throw 'build failed' }

$dshHome = $env:DSH_HOME
if (-not $dshHome) { $dshHome = Join-Path $env:USERPROFILE '.dsh' }
$profileDir = Join-Path $dshHome "profiles\$Profile"
if (-not (Test-Path $profileDir)) {
  throw "profile '$Profile' not found at $profileDir. Create it first: dsh $Profile --from-default-profile web --dump-config"
}

Write-Host "[2/4] installing bundle into profile '$Profile'..."
$spec = 'file:' + ($root -replace '\\', '/')
dsh plugin --profile $Profile add $spec
if ($LASTEXITCODE -ne 0) { throw 'plugin install failed' }

Write-Host '[3/4] switching installed copy to a junction (live dev loop)...'
$target = Join-Path $profileDir 'node_modules\dsh-token-manager'
if (Test-Path $target) { Remove-Item $target -Recurse -Force }
cmd /c mklink /J "$target" "$root" | Out-Null

Write-Host '[4/4] done. Next:'
Write-Host "  dsh $Profile --port $Port --no-open"
Write-Host '  (the printed URL contains a one-time token; open it in the browser)'