# Keeps Postgres, the API, and one public link running on this PC.
# The phone always calls https://nirapad-transit.vercel.app.
param([switch]$Loop)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$log = Join-Path $root ".tunnel.log"
$state = Join-Path $root ".tunnel-url"
$pidFile = Join-Path $root ".tunnel.pid"
$lock = Join-Path $root ".tunnel.lock"
$exe = "C:\Program Files (x86)\cloudflared\cloudflared.exe"
$site = "https://nirapad-transit.vercel.app"

function Our-Tunnels {
  Get-CimInstance Win32_Process -Filter "Name = 'cloudflared.exe'" | Where-Object {
    $_.CommandLine -and $_.CommandLine -like "*.tunnel.log*"
  }
}

function Stop-OtherTunnels {
  Get-CimInstance Win32_Process -Filter "Name = 'cloudflared.exe'" | Where-Object {
    -not ($_.CommandLine -and $_.CommandLine -like "*.tunnel.log*")
  } | ForEach-Object {
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
  }
}

function Read-TunnelUrl {
  if (-not (Test-Path $log)) { return $null }
  $text = Get-Content $log -Raw -ErrorAction SilentlyContinue
  $matches = [regex]::Matches($text, "https://[a-z0-9-]+\.trycloudflare\.com")
  if ($matches.Count -eq 0) { return $null }
  return $matches[$matches.Count - 1].Value
}

function Test-TunnelHealth([string]$url) {
  try {
    $res = Invoke-WebRequest -Uri "$url/health" -UseBasicParsing -TimeoutSec 20
    return $res.StatusCode -eq 200
  } catch {
    return $false
  }
}

function Start-DataStores {
  $compose = Join-Path $root "docker-compose.yml"
  $previous = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  docker compose -f $compose up -d db redis | Out-Null
  $ErrorActionPreference = $previous
}

function Test-LocalApi {
  try {
    $res = Invoke-WebRequest -Uri "http://127.0.0.1:4000/health" -UseBasicParsing -TimeoutSec 5
    return $res.StatusCode -eq 200
  } catch {
    return $false
  }
}

function Start-Api {
  Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" | Where-Object {
    $_.CommandLine -and (
      $_.CommandLine -like "*dev:backend*" -or
      $_.CommandLine -like "*dev -w backend*" -or
      $_.CommandLine -like "*tsx*watch src/index.ts*"
    )
  } | ForEach-Object {
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
  }
  Start-Sleep -Seconds 1
  $node = "C:\Program Files\nodejs\node.exe"
  $tsx = Join-Path $root "node_modules\tsx\dist\cli.mjs"
  Start-Process -FilePath $node -WorkingDirectory (Join-Path $root "backend") -WindowStyle Hidden -ArgumentList @(
    $tsx, "watch", "src/index.ts"
  )
}

function Start-Tunnel {
  if (Test-Path $log) { Remove-Item $log -Force -ErrorAction SilentlyContinue }
  $env:TUNNEL_TRANSPORT_PROTOCOL = "http2"
  Start-Process -FilePath $exe -WindowStyle Hidden -ArgumentList @(
    "--edge-ip-version", "4",
    "tunnel",
    "--url", "http://127.0.0.1:4000",
    "--no-autoupdate",
    "--retries", "100",
    "--logfile", $log,
    "--loglevel", "info",
    "--pidfile", $pidFile
  )
}

function Invoke-Keep {
if (-not (Test-LocalApi)) {
  Start-DataStores
  Start-Api
  $apiUp = $false
  for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep -Seconds 2
    if (Test-LocalApi) { $apiUp = $true; break }
  }
  if (-not $apiUp) { throw "The API on port 4000 did not start." }
}

if (Test-Path $lock) {
  $age = (Get-Date) - (Get-Item $lock).LastWriteTime
  if ($age.TotalMinutes -lt 12) { return }
  Remove-Item $lock -Force -ErrorAction SilentlyContinue
}

Stop-OtherTunnels

$saved = ""
if (Test-Path $state) { $saved = (Get-Content $state -Raw).Trim() }
$running = @(Our-Tunnels)
if ($running.Count -gt 0 -and $saved -and (Test-TunnelHealth $saved)) {
  Write-Output "UNCHANGED $saved"
  return
}

Get-CimInstance Win32_Process -Filter "Name = 'cloudflared.exe'" | ForEach-Object {
  Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
}
Start-Sleep -Seconds 1
Start-Tunnel

$url = $null
for ($i = 0; $i -lt 25; $i++) {
  Start-Sleep -Seconds 2
  $url = Read-TunnelUrl
  if ($url -and (Test-TunnelHealth $url)) { break }
  $url = $null
}
if (-not $url) { throw "The public API link did not come up. The API on port 4000 must already be running." }

if ($url -eq $saved) {
  Write-Output "RESTORED $url"
  return
}

New-Item -ItemType File -Path $lock -Force | Out-Null
try {
  Set-Location $root
  node scripts/set-origin.mjs $url
  if ($LASTEXITCODE -ne 0) { throw "Could not publish the API address" }
  Set-Content -Path $state -Value $url -NoNewline
  Write-Output "PUBLISHED $url"
} finally {
  Remove-Item $lock -Force -ErrorAction SilentlyContinue
}
}

if ($Loop) {
  $mutex = New-Object System.Threading.Mutex($false, "Global\NirapadTransitKeepAlive")
  if (-not $mutex.WaitOne(0)) { exit 0 }
  while ($true) {
    try {
      Invoke-Keep
    } catch {
      Write-Output $_.Exception.Message
    }
    Start-Sleep -Seconds 20
  }
} else {
  Invoke-Keep
}
