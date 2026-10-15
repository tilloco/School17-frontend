# Starts Expo with a Cloudflare quick tunnel so the phone can reach Metro without USB or same-network Wi-Fi.
# Usage (PowerShell, any folder):  .\scripts\dev-tunnel.ps1     then open the printed exp:// address in Expo Go (type it with "Enter URL manually").
$root = Split-Path -Parent $PSScriptRoot
$port = 8090
$log = Join-Path $env:TEMP 'cloudflared-expo.log'
Remove-Item $log -ErrorAction SilentlyContinue
$cf = Start-Process -FilePath (Join-Path $root 'tools\cloudflared.exe') -ArgumentList "tunnel --url http://localhost:$port --no-autoupdate" -RedirectStandardError $log -PassThru -WindowStyle Hidden
$url = $null
for ($i = 0; $i -lt 40 -and -not $url; $i++) {
  Start-Sleep -Seconds 1
  if (Test-Path $log) { $m = Select-String -Path $log -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' | Select-Object -First 1; if ($m) { $url = $m.Matches[0].Value } }
}
if (-not $url) { Write-Host 'Could not get a tunnel address. See' $log; Stop-Process -Id $cf.Id; exit 1 }
$host2 = $url -replace '^https://', ''
Write-Host ''
Write-Host "Open this in Expo Go (Enter URL manually):  exp://$host2"
Write-Host ''
$env:EXPO_PACKAGER_PROXY_URL = $url
Set-Location (Join-Path $root 'mobile')
try { npx expo start -c --port $port } finally { Stop-Process -Id $cf.Id -ErrorAction SilentlyContinue }
