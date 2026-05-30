@echo off
setlocal

for %%I in ("%~dp0.") do set "PROJECT_DIR=%%~fI"
set "APP_URL=http://127.0.0.1:5173/"
set "PID_FILE=%PROJECT_DIR%\.amazon-image-studio-dev.pid"

where npm >nul 2>nul
if errorlevel 1 (
  echo npm was not found. Please install Node.js first.
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$project = (Resolve-Path -LiteralPath '%PROJECT_DIR%').Path;" ^
  "$appName = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('5Lqa6ams6YCK5Zu+54mH5bel5L2c5Y+w'));" ^
  "$serverTitle = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('5Lqa6ams6YCK5Zu+54mH5bel5L2c5Y+w5byA5Y+R5pyN5Yqh5Zmo'));" ^
  "$projectMatch = $project;" ^
  "$pidFile = '%PID_FILE%';" ^
  "$existing = Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1;" ^
  "if ($existing) {" ^
  "  $procInfo = Get-CimInstance Win32_Process -Filter ('ProcessId=' + $existing.OwningProcess) -ErrorAction SilentlyContinue;" ^
  "  $commandLine = [string]$procInfo.CommandLine;" ^
  "  if ($commandLine -like ('*' + $projectMatch + '*')) {" ^
  "    Start-Process '%APP_URL%';" ^
  "    Write-Host ($appName + ' is already running at %APP_URL%');" ^
  "    exit 0;" ^
  "  }" ^
  "  Write-Host ('Port 5173 is already used by another process. Please close it first. PID: ' + $existing.OwningProcess);" ^
  "  exit 1;" ^
  "}" ^
  "$cmd = 'title ' + $serverTitle + ' && npm run dev -- --host 127.0.0.1 --port 5173 --strictPort';" ^
  "$process = Start-Process -FilePath 'cmd.exe' -ArgumentList @('/k', $cmd) -WorkingDirectory $project -PassThru;" ^
  "Set-Content -LiteralPath $pidFile -Value $process.Id -Encoding ASCII;" ^
  "Start-Sleep -Seconds 3;" ^
  "Start-Process '%APP_URL%';" ^
  "Write-Host ('Started ' + $appName + ' at %APP_URL%');"

endlocal
