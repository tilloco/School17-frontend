# Video testing on a phone needs the phone and the laptop on ONE network (USB carries chat but not video).
# This turns on the Windows Mobile Hotspot with a random password and joins the connected phone to it over adb.
# One-time: allow the local video server through the firewall (run once in an Administrator PowerShell):
#   New-NetFirewallRule -DisplayName "LiveKit dev" -Direction Inbound -Program "$env:USERPROFILE\Downloads\livekit-dev\livekit-server.exe" -Action Allow -Profile Any
# Turn the hotspot off again with:  .\dev-hotspot.ps1 -Off
param([switch]$Off)
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Networking.Connectivity.NetworkInformation,Windows.Networking.Connectivity,ContentType=WindowsRuntime]
$null = [Windows.Networking.NetworkOperators.NetworkOperatorTetheringManager,Windows.Networking.NetworkOperators,ContentType=WindowsRuntime]
$profile = [Windows.Networking.Connectivity.NetworkInformation]::GetInternetConnectionProfile()
if (-not $profile) { throw 'No internet connection to share.' }
$mgr = [Windows.Networking.NetworkOperators.NetworkOperatorTetheringManager]::CreateFromConnectionProfile($profile)
if ($Off) { $mgr.StopTetheringAsync() | Out-Null; Write-Host 'Hotspot off.'; return }
$pass = -join ((48..57) + (97..122) | Get-Random -Count 12 | ForEach-Object { [char]$_ })
$cfg = New-Object Windows.Networking.NetworkOperators.NetworkOperatorTetheringAccessPointConfiguration
$cfg.Ssid = 'S17TEST'; $cfg.Passphrase = $pass
$mgr.ConfigureAccessPointAsync($cfg) | Out-Null
Start-Sleep 2
$mgr.StartTetheringAsync() | Out-Null
Start-Sleep 4
$adb = Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe'
& $adb shell cmd wifi connect-network S17TEST wpa2 $pass | Out-Null
Write-Host "Hotspot S17TEST is on (password: $pass). The phone was asked to join it."
