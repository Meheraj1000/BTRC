# Keeps one public link to the API on this PC, and points the Vercel site at it
# when that link changes. The phone always calls https://nirapad-transit.vercel.app.
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

if (Test-Path $lock) {
  $age = (Get-Date) - (Get-Item $lock).LastWriteTime
  if ($age.TotalMinutes -lt 12) { exit 0 }
  Remove-Item $lock -Force -ErrorAction SilentlyContinue
}

Stop-OtherTunnels

$saved = ""
if (Test-Path $state) { $saved = (Get-Content $state -Raw).Trim() }
$running = @(Our-Tunnels)
if ($running.Count -gt 0 -and $saved -and (Test-TunnelHealth $saved)) {
  Write-Output "UNCHANGED $saved"
  exit 0
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
  exit 0
}

New-Item -ItemType File -Path $lock -Force | Out-Null
try {
  Set-Location $root
  npx vercel env add API_ORIGIN --environment production,preview,development --value $url --force --no-sensitive --yes --cwd frontend --project nirapad-transit
  if ($LASTEXITCODE -ne 0) { throw "Could not update API_ORIGIN" }
  npx vercel env add NEXT_PUBLIC_API_URL --environment production,preview,development --value "$site/api" --force --no-sensitive --yes --cwd frontend --project nirapad-transit
  if ($LASTEXITCODE -ne 0) { throw "Could not update NEXT_PUBLIC_API_URL" }
  npx vercel env add NEXT_PUBLIC_WS_URL --environment production,preview,development --value $site --force --no-sensitive --yes --cwd frontend --project nirapad-transit
  if ($LASTEXITCODE -ne 0) { throw "Could not update NEXT_PUBLIC_WS_URL" }
  npx vercel deploy --cwd frontend --prod --yes --project nirapad-transit
  if ($LASTEXITCODE -ne 0) { throw "Production deploy failed" }
  Set-Content -Path $state -Value $url -NoNewline
  Write-Output "PUBLISHED $url"
} finally {
  Remove-Item $lock -Force -ErrorAction SilentlyContinue
}
