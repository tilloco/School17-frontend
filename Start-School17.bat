@echo off
rem Double-click to run the NEW School17 app on your phone.
rem  - Phone plugged in by USB (USB debugging on): uses USB, opens the app by itself.
rem  - Otherwise: starts the tunnel mode and shows a QR code to scan with Expo Go.
cd /d "%~dp0"
set ADB=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe
if exist "%ADB%" (
  "%ADB%" devices | findstr /R /C:"device$" >nul
  if not errorlevel 1 (
    echo Phone found over USB.
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\dev-usb.ps1"
    goto :end
  )
)
echo No phone on USB: using the tunnel and QR code.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\dev-tunnel.ps1"
:end
echo.
if not "%S17_NOPAUSE%"=="1" pause
