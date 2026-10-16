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
  $env:DATABASE_URL = 'postgresql://postgres@127.0.0.1:54329/school17_test?schema=public'
  Push-Location (Join-Path $root 'backend')
  & npx prisma migrate deploy 2>&1 | Out-Null
  Pop-Location

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

  $env:EXPO_PUBLIC_API_URL = "http://localhost:$apiPort"
  $env:EXPO_PUBLIC_DEV_LOGIN = '1'
  $env:REACT_NATIVE_PACKAGER_HOSTNAME = 'localhost'
  Write-Host "4/4 Starting the app (first load takes a minute or two). It opens on the phone by itself; if not, open Expo Go > Enter URL manually > exp://localhost:$metroPort"
  # Open Expo Go on the project a few seconds after Metro starts
  $opener = Start-Job -ScriptBlock { param($adb, $port) Start-Sleep -Seconds 25; & $adb shell am start -a android.intent.action.VIEW -d "exp://localhost:$port" host.exp.exponent | Out-Null } -ArgumentList $adb, $metroPort
  Set-Location (Join-Path $root 'mobile')
  npx expo start -c --localhost --port $metroPort
} catch {
  Write-Host ''
  Write-Host $_.Exception.Message -ForegroundColor Yellow
  exit 1
} finally {
  foreach ($p in $procs) { Stop-Process -Id $p.Id -ErrorAction SilentlyContinue }
}
