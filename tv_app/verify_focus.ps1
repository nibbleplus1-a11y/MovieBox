# Script to verify D-Pad Focus Navigation sequence on Android TV / Emulator
# Key events: 19=UP, 20=DOWN, 21=LEFT, 22=RIGHT, 23=OK

param(
    [string]$AdbPath = "E:\Android\Sdk\platform-tools\adb.exe",
    [string]$Package = "com.movieverse.tv.debug"
)

Write-Host "=== MovieVerse TV Focus Test Sequence ===" -ForegroundColor Cyan
Write-Host "Adb: $AdbPath"
Write-Host "Target: $Package"

# Clear logcat
& $AdbPath logcat -c

# Launch the app
Write-Host "Launching app..." -ForegroundColor Yellow
& $AdbPath shell monkey -p $Package -c android.intent.category.LEANBACK_LAUNCHER 1
Start-Sleep -Milliseconds 2500

function Send-Key([int]$code, [string]$name, [int]$count = 1) {
    for ($i = 1; $i -le $count; $i++) {
        Write-Host "-> Sending Key: $name ($code) [$i/$count]" -ForegroundColor Gray
        & $AdbPath shell input keyevent $code
        Start-Sleep -Milliseconds 400
    }
}

Write-Host "`nExecuting Required Test Sequence:" -ForegroundColor Green
Write-Host "1. start (Play)"
Start-Sleep -Milliseconds 500

Write-Host "2. DOWN x3"
Send-Key 20 "DOWN" 3

Write-Host "3. UP x3"
Send-Key 19 "UP" 3

Write-Host "4. RIGHT x2"
Send-Key 22 "RIGHT" 2

Write-Host "5. LEFT x3 (must reach rail)"
Send-Key 21 "LEFT" 3

Write-Host "6. RIGHT"
Send-Key 22 "RIGHT" 1

Write-Host "`n=== CAPTURED FOCUS LOGS ===" -ForegroundColor Cyan
& $AdbPath logcat -d -s FOCUS:D | Select-String "FOCUS"
