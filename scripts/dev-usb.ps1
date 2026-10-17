# USB mode: the most reliable way to run the app on your phone. No tunnel, no QR, nothing to type: the app opens by itself.
# Needs: phone plugged in by USB, USB debugging ON (Developer options), Expo Go installed. Called by Start-School17.bat.
$root = Split-Path -Parent $PSScriptRoot
$adb = Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe'
$procs = @()

function Find-FreePort($start) { for ($p = $start; $p -lt $start + 50; $p++) { if (-not (Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue)) { return $p } }; throw "No free port near $start" }
$apiPort = Find-FreePort 3100
$metroPort = Find-FreePort 8090

try {
  if (-not (Test-Path $adb)) { throw "adb not found at $adb. Install Android platform-tools." }
  $dev = & $adb devices | Select-String -Pattern '\tdevice$'
  if (-not $dev) { throw 'No phone found. Plug it in by USB, turn on USB debugging and tap Allow on the phone, then run this again.' }

  Write-Host '1/4 Starting the local test database...'
  & bash (Join-Path $root 'backend/scripts/dev-db.sh') start | Out-Null
  $env:DATABASE_URL = 'postgresql://postgres@127.0.0.1:54329/school17_demo_test?schema=public'  # demo data lives here; the tests use school17_test
  Push-Location (Join-Path $root 'backend')
  & npx prisma migrate deploy 2>&1 | Out-Null
  Pop-Location

  # Video calls: a local LiveKit server (free, open source). The binary is downloaded once to Downloads\livekit-dev (see docs/CALLS.md).
  $lkExe = Join-Path $env:USERPROFILE 'Downloads\livekit-dev\livekit-server.exe'
  if (Test-Path $lkExe) {
    $lkSecret = -join ((48..57) + (97..122) | Get-Random -Count 40 | ForEach-Object { [char]$_ })
    $lkCfg = Join-Path $env:TEMP 's17-livekit.yaml'
    @"
port: 7880
bind_addresses: ["0.0.0.0"]
rtc:
  tcp_port: 7881
  port_range_start: 50000
  port_range_end: 50100
  use_external_ip: false
  node_ip: 127.0.0.1
keys:
  devkey: $lkSecret
webhook:
  api_key: devkey
  urls: ["http://localhost:$apiPort/calls/webhook"]
logging:
  level: info
"@ | Set-Content -Encoding ASCII $lkCfg
    if (-not (Get-NetTCPConnection -LocalPort 7880 -State Listen -ErrorAction SilentlyContinue)) {
      $lk = Start-Process -FilePath $lkExe -ArgumentList @('--config', $lkCfg) -PassThru -WindowStyle Hidden -RedirectStandardOutput (Join-Path $env:TEMP 'livekit.log') -RedirectStandardError (Join-Path $env:TEMP 'livekit.err.log')
      $procs += $lk
      Start-Sleep -Seconds 2
    }
    $env:CALL_PROVIDER = 'livekit'; $env:LIVEKIT_URL = 'ws://localhost:7880'; $env:LIVEKIT_API_KEY = 'devkey'; $env:LIVEKIT_API_SECRET = $lkSecret
  }

  Write-Host '2/4 Starting the local backend (new code, test database only)...'
  $run = Join-Path $root 'backend\.devdb\run'
  New-Item -ItemType Directory -Force $run | Out-Null
  $env:PORT = "$apiPort"
  $api = Start-Process -FilePath 'node' -ArgumentList @('-r', 'ts-node/register/transpile-only', (Join-Path $root 'backend\scripts\dev-server.ts')) -WorkingDirectory $run -PassThru -WindowStyle Hidden -RedirectStandardOutput (Join-Path $env:TEMP 'dev-backend.log') -RedirectStandardError (Join-Path $env:TEMP 'dev-backend.err.log')
  $procs += $api
  for ($i = 0; $i -lt 60; $i++) { Start-Sleep -Seconds 2; try { Invoke-WebRequest -UseBasicParsing "http://localhost:$apiPort/dev/login" -Method Post -ContentType 'application/json' -Body '{"role":"STUDENT"}' -TimeoutSec 5 | Out-Null; break } catch { } }

  Write-Host '3/4 Connecting the phone over USB...'
  & $adb reverse "tcp:$metroPort" "tcp:$metroPort" | Out-Null
  & $adb reverse "tcp:$apiPort" "tcp:$apiPort" | Out-Null
  & $adb reverse tcp:7880 tcp:7880 | Out-Null  # LiveKit signalling
  & $adb reverse tcp:7881 tcp:7881 | Out-Null  # LiveKit media over TCP (USB cannot carry UDP)

  $env:EXPO_PUBLIC_API_URL = "http://localhost:$apiPort"
  $env:EXPO_PUBLIC_DEV_LOGIN = '1'
  $env:REACT_NATIVE_PACKAGER_HOSTNAME = 'localhost'
  Write-Host "4/4 Starting the app (first load takes a minute or two). It opens on the phone by itself; if not, open Expo Go > Enter URL manually > exp://localhost:$metroPort"
  # Open Expo Go on the project a few seconds after Metro starts
  $opener = Start-Job -ScriptBlock { param($adb, $port) Start-Sleep -Seconds 25; & $adb shell am start -a android.intent.action.VIEW -d "exp://127.0.0.1:$port" host.exp.exponent | Out-Null } -ArgumentList $adb, $metroPort
  Set-Location (Join-Path $root 'mobile')
  npx expo start -c --port $metroPort
} catch {
  Write-Host ''
  Write-Host $_.Exception.Message -ForegroundColor Yellow
  exit 1
} finally {
  foreach ($p in $procs) { Stop-Process -Id $p.Id -ErrorAction SilentlyContinue }
}
