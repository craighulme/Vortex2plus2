param(
    [int]$GameId = 9
)

$ErrorActionPreference = "Stop"

$relayDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$relayCmd = Join-Path $relayDir "Start-NativeRelay.cmd"

function Start-RelayIfNeeded {
    $listeners = @(Get-NetTCPConnection -LocalPort 27822 -State Listen -ErrorAction SilentlyContinue)
    if ($listeners.Count -gt 0) {
        Write-Host "Vortex2+2 relay already listening on ws://127.0.0.1:27822/ws"
        return
    }

    if (-not (Test-Path $relayCmd)) {
        throw "Missing relay launcher: $relayCmd"
    }

    Write-Host "Starting Vortex2+2 relay for game $GameId..."
    Start-Process -FilePath "cmd.exe" -ArgumentList @("/k", "`"$relayCmd`"") -WorkingDirectory $relayDir -WindowStyle Normal | Out-Null

    $deadline = (Get-Date).AddSeconds(15)
    while ((Get-Date) -lt $deadline) {
        $listeners = @(Get-NetTCPConnection -LocalPort 27822 -State Listen -ErrorAction SilentlyContinue)
        if ($listeners.Count -gt 0) {
            Write-Host "Vortex2+2 relay is listening on ws://127.0.0.1:27822/ws"
            return
        }
        Start-Sleep -Milliseconds 250
    }

    throw "Timed out waiting for Vortex2+2 relay to listen on port 27822."
}

Start-RelayIfNeeded
