$dist = Join-Path (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path "dist"
if (-not (Test-Path -LiteralPath $dist)) {
  Write-Host "Build directory is already clean."
  exit 0
}

for ($attempt = 1; $attempt -le 6; $attempt++) {
  try {
    Remove-Item -LiteralPath $dist -Recurse -Force -ErrorAction Stop
    Write-Host "Cleaned previous build output."
    exit 0
  } catch {
    if ($attempt -eq 6) {
      Write-Error "Could not clean $dist. Close Explorer windows, editors, or antivirus scans using this folder, then retry. $($_.Exception.Message)"
      exit 1
    }
    Start-Sleep -Milliseconds (250 * $attempt)
  }
}
