$ErrorActionPreference = "Stop"

$source = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")
$target = "S:\pr-local"

if (-not ($source.Path -like "S:\rp*")) {
  throw "Unexpected source path: $($source.Path)"
}

New-Item -ItemType Directory -Path $target -Force | Out-Null

robocopy $source.Path $target /MIR /XD node_modules dist .astro .wrangler .git "RP-Re Player" /XF .env /NFL /NDL /NJH /NJS /NP
$code = $LASTEXITCODE
if ($code -gt 7) {
  throw "robocopy failed with exit code $code"
}

$launcher = @'
@echo off
setlocal
cd /d "%~dp0"
if not exist node_modules (
  call npm.cmd install --no-audit --no-fund
)
call npm.cmd run dev
pause
'@

$oneClickName = "$([char]0x4e00)$([char]0x952e)$([char]0x542f)$([char]0x52a8).cmd"

Set-Content -LiteralPath (Join-Path $target "run-local-preview.cmd") -Value $launcher -Encoding ASCII
Set-Content -LiteralPath (Join-Path $target $oneClickName) -Value $launcher -Encoding ASCII
Write-Host "Synced Re Player to $target"
