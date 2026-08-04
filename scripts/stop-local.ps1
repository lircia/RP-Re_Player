$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$all = @(Get-CimInstance Win32_Process)
$byId = @{}
$children = @{}

foreach ($process in $all) {
  $byId[[int]$process.ProcessId] = $process
  $parentId = [int]$process.ParentProcessId
  if (-not $children.ContainsKey($parentId)) {
    $children[$parentId] = [System.Collections.Generic.List[int]]::new()
  }
  $children[$parentId].Add([int]$process.ProcessId)
}

$escapedRoot = [Regex]::Escape($projectRoot)
$seeds = @($all | Where-Object {
  $_.ProcessId -ne $PID -and
  $_.CommandLine -and
  $_.CommandLine -match $escapedRoot -and
  $_.CommandLine -match "(?i)(wrangler|workerd|dist[\\/]server[\\/]wrangler\.json|scripts[\\/]local\.mjs)"
})

$targetIds = [System.Collections.Generic.HashSet[int]]::new()
$queue = [System.Collections.Generic.Queue[int]]::new()
foreach ($seed in $seeds) {
  $id = [int]$seed.ProcessId
  $targetIds.Add($id) | Out-Null
  $queue.Enqueue($id)
}

while ($queue.Count) {
  $id = $queue.Dequeue()
  if (-not $children.ContainsKey($id)) { continue }
  foreach ($childId in $children[$id]) {
    if ($targetIds.Add($childId)) { $queue.Enqueue($childId) }
  }
}

foreach ($seed in $seeds) {
  $parentId = [int]$seed.ParentProcessId
  while ($byId.ContainsKey($parentId)) {
    $parent = $byId[$parentId]
    if (-not $parent.CommandLine -or $parent.CommandLine -notmatch "(?i)(scripts[\\/]local\.mjs|wrangler|npm-cli\.js|npx)") { break }
    $targetIds.Add($parentId) | Out-Null
    $parentId = [int]$parent.ParentProcessId
  }
}

if (-not $targetIds.Count) {
  Write-Host "No previous Re Player local service is running."
  exit 0
}

$ordered = @($targetIds | Sort-Object -Descending)
foreach ($id in $ordered) {
  Stop-Process -Id $id -Force -ErrorAction SilentlyContinue
}

Start-Sleep -Milliseconds 500
$remaining = @($ordered | Where-Object { Get-Process -Id $_ -ErrorAction SilentlyContinue })
if ($remaining.Count) {
  Write-Error "Could not stop Re Player process IDs: $($remaining -join ', ')"
  exit 1
}

Write-Host "Stopped previous Re Player local service."
