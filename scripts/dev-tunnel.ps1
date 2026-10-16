# One command to try the NEW School17 app on a phone in Expo Go, no USB and no shared Wi-Fi needed.
# Starts: local throwaway database -> local NEW backend (dev login, never production) -> two Cloudflare tunnels (backend, Metro) -> Expo.
# Usage (PowerShell):  powershell -ExecutionPolicy Bypass -File .\scripts\dev-tunnel.ps1
# Then in Expo Go: "Enter URL manually" -> the exp:// address printed below. On the login screen use "Test teacher" / "Test pupil" / "Test guardian".
$root = Split-Path -Parent $PSScriptRoot
$cf = Join-Path $root 'tools\cloudflared.exe'
function Find-FreePort($start) { for ($p = $start; $p -lt $start + 50; $p++) { if (-not (Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue)) { return $p } }; throw "No free port near $start" }
# Old servers from earlier runs may still hold ports; pick free ones so this run always uses the CURRENT code.
$apiPort = Find-FreePort 3100
$metroPort = Find-FreePort 8090
$procs = @()

function Start-Tunnel($port, $name) {
  # http2 (TCP) is far more reliable than the default QUIC (UDP) on phone tethering and strict networks.
  # The address only counts once cloudflared says "Registered tunnel connection"; otherwise the tunnel is restarted (up to 4 tries).
  for ($try = 1; $try -le 4; $try++) {
    $log = Join-Path $env:TEMP "cloudflared-$name.log"
    Remove-Item $log -ErrorAction SilentlyContinue
    $p = Start-Process -FilePath $cf -ArgumentList "tunnel --url http://localhost:$port --no-autoupdate --protocol http2" -RedirectStandardError $log -PassThru -WindowStyle Hidden
    $url = $null
    for ($i = 0; $i -lt 40; $i++) {
      Start-Sleep -Seconds 1
      if (-not (Test-Path $log)) { continue }
      $text = Get-Content $log -Raw -ErrorAction SilentlyContinue
      if (-not $text) { continue }
      if (-not $url) {
        $m = [regex]::Matches($text, 'https://[a-z0-9-]+\.trycloudflare\.com') | Where-Object { $_.Value -ne 'https://api.trycloudflare.com' } | Select-Object -First 1
        if ($m) { $url = $m.Value }
      }
      if ($url -and $text -match 'Registered tunnel connection') { $script:procs += $p; return $url }
    }
    Write-Host "  tunnel $name not ready (try $try of 4), retrying..."
    Stop-Process -Id $p.Id -ErrorAction SilentlyContinue
  }
  throw "No working tunnel for $name (see $log)"
}

try {
  Write-Host '1/5 Starting the local test database...'
  & bash (Join-Path $root 'backend/scripts/dev-db.sh') start | Out-Null
  $env:DATABASE_URL = 'postgresql://postgres@127.0.0.1:54329/school17_test?schema=public'
  Push-Location (Join-Path $root 'backend')
  & npx prisma migrate deploy | Out-Null
  Pop-Location

  Write-Host '2/5 Starting the local backend (new code, test database only)...'
  $run = Join-Path $root 'backend\.devdb\run'
  New-Item -ItemType Directory -Force $run | Out-Null
  $env:PORT = "$apiPort"
  $api = Start-Process -FilePath 'node' -ArgumentList @('-r', 'ts-node/register/transpile-only', (Join-Path $root 'backend\scripts\dev-server.ts')) -WorkingDirectory $run -PassThru -WindowStyle Hidden -RedirectStandardOutput (Join-Path $env:TEMP 'dev-backend.log') -RedirectStandardError (Join-Path $env:TEMP 'dev-backend.err.log')
  $procs += $api
  for ($i = 0; $i -lt 60; $i++) { Start-Sleep -Seconds 2; try { Invoke-WebRequest -UseBasicParsing "http://localhost:$apiPort/dev/login" -Method Post -ContentType 'application/json' -Body '{"role":"STUDENT"}' -TimeoutSec 5 | Out-Null; break } catch { } }

  Write-Host '3/5 Opening the backend tunnel...'
  $apiUrl = Start-Tunnel $apiPort 'api'
  Write-Host '4/5 Opening the Metro tunnel...'
  $metroUrl = Start-Tunnel $metroPort 'metro'

  $hostOnly = $metroUrl -replace '^https://', ''
  Write-Host ''
  Write-Host "5/5 READY. In Expo Go choose Enter URL manually and type:  exp://$hostOnly"
  Write-Host "Backend for the app: $apiUrl (local test data only)"
  Write-Host ''
  $env:EXPO_PACKAGER_PROXY_URL = $metroUrl
  $env:EXPO_PUBLIC_API_URL = $apiUrl
  $env:EXPO_PUBLIC_DEV_LOGIN = '1'
  Set-Location (Join-Path $root 'mobile')
  npx expo start -c --port $metroPort
} finally {
  foreach ($p in $procs) { Stop-Process -Id $p.Id -ErrorAction SilentlyContinue }
}
