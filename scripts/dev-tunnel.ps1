# One command to try the NEW School17 app on a phone in Expo Go: scan the QR code, nothing to type.
# Starts: local throwaway database -> local NEW backend (dev login, never production) -> one small proxy -> ONE Cloudflare tunnel -> Expo.
# Usage (PowerShell):  powershell -ExecutionPolicy Bypass -File .\scripts\dev-tunnel.ps1
# Then in Expo Go choose "Scan QR code" and scan the QR printed below. On the login screen use "Test teacher" / "Test pupil" / "Test guardian".
$root = Split-Path -Parent $PSScriptRoot
$cf = Join-Path $root 'tools\cloudflared.exe'
$procs = @()

function Find-FreePort($start) { for ($p = $start; $p -lt $start + 50; $p++) { if (-not (Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue)) { return $p } }; throw "No free port near $start" }
# Old servers from earlier runs may still hold ports; pick free ones so this run always uses the CURRENT code.
$apiPort = Find-FreePort 3100
$metroPort = Find-FreePort 8090
$proxyPort = Find-FreePort 8200

function Start-Tunnel($port) {
  # http2 (TCP) is more reliable than QUIC (UDP) on phone tethering. Cloudflare's quick-tunnel API sometimes times out on weak networks, so retry.
  for ($try = 1; $try -le 8; $try++) {
    $log = Join-Path $env:TEMP 'cloudflared-dev.log'
    Remove-Item $log -ErrorAction SilentlyContinue
    $p = Start-Process -FilePath $cf -ArgumentList "tunnel --url http://127.0.0.1:$port --no-autoupdate --protocol http2" -RedirectStandardError $log -PassThru -WindowStyle Hidden
    $url = $null
    for ($i = 0; $i -lt 40; $i++) {
      Start-Sleep -Seconds 1
      if (-not (Test-Path $log)) { continue }
      $text = Get-Content $log -Raw -ErrorAction SilentlyContinue
      if (-not $text) { continue }
      if ($text -match 'failed to request quick Tunnel') { break }
      if (-not $url) {
        $m = [regex]::Matches($text, 'https://[a-z0-9-]+\.trycloudflare\.com') | Where-Object { $_.Value -ne 'https://api.trycloudflare.com' } | Select-Object -First 1
        if ($m) { $url = $m.Value }
      }
      if ($url -and $text -match 'Registered tunnel connection') { $script:procs += $p; return $url }
    }
    Write-Host "  tunnel not ready (try $try of 8), retrying..."
    Stop-Process -Id $p.Id -ErrorAction SilentlyContinue
  }
  throw "Could not open a tunnel (see $log). Your network may block Cloudflare; try another Wi-Fi or USB (adb reverse)."
}

try {
  Write-Host '1/5 Starting the local test database...'
  & bash (Join-Path $root 'backend/scripts/dev-db.sh') start | Out-Null
  $env:DATABASE_URL = 'postgresql://postgres@127.0.0.1:54329/school17_test?schema=public'
  Push-Location (Join-Path $root 'backend')
  & npx prisma migrate deploy 2>&1 | Out-Null
  Pop-Location

  Write-Host '2/5 Starting the local backend (new code, test database only)...'
  $run = Join-Path $root 'backend\.devdb\run'
  New-Item -ItemType Directory -Force $run | Out-Null
  $env:PORT = "$apiPort"
  $api = Start-Process -FilePath 'node' -ArgumentList @('-r', 'ts-node/register/transpile-only', (Join-Path $root 'backend\scripts\dev-server.ts')) -WorkingDirectory $run -PassThru -WindowStyle Hidden -RedirectStandardOutput (Join-Path $env:TEMP 'dev-backend.log') -RedirectStandardError (Join-Path $env:TEMP 'dev-backend.err.log')
  $procs += $api
  for ($i = 0; $i -lt 60; $i++) { Start-Sleep -Seconds 2; try { Invoke-WebRequest -UseBasicParsing "http://localhost:$apiPort/dev/login" -Method Post -ContentType 'application/json' -Body '{"role":"STUDENT"}' -TimeoutSec 5 | Out-Null; break } catch { } }

  Write-Host '3/5 Starting the front door (one tunnel for app + backend)...'
  $proxy = Start-Process -FilePath 'node' -ArgumentList @((Join-Path $root 'scripts\dev-proxy.js'), "$proxyPort", "$metroPort", "$apiPort") -PassThru -WindowStyle Hidden
  $procs += $proxy

  Write-Host '4/5 Opening the tunnel (can take a minute)...'
  $url = Start-Tunnel $proxyPort
  $hostOnly = $url -replace '^https://', ''
  $expUrl = "exps://$hostOnly"

  Write-Host ''
  Write-Host '5/5 READY. Open Expo Go and tap "Scan QR code", then scan this:'
  Write-Host ''
  Push-Location (Join-Path $root 'tools')
  & node -e "require('qrcode-terminal').generate(process.argv[1], { small: true })" $expUrl
  Pop-Location
  Write-Host ''
  Write-Host "(If the camera cannot read it, choose Enter URL manually and type: $expUrl )"
  Write-Host 'First load takes a minute or two while the app is bundled.'
  Write-Host ''
  $env:EXPO_PACKAGER_PROXY_URL = $url
  $env:EXPO_PUBLIC_API_URL = "$url/_api"
  $env:EXPO_PUBLIC_DEV_LOGIN = '1'
  Set-Location (Join-Path $root 'mobile')
  npx expo start -c --port $metroPort
} finally {
  foreach ($p in $procs) { Stop-Process -Id $p.Id -ErrorAction SilentlyContinue }
}
