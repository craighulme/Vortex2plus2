param(
    [string]$Uri = ""
)

$ErrorActionPreference = "Stop"

$script = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "Start-NativeBridge.ps1"
$gameId = 9

if ($Uri -match '^v22bridge://') {
    Add-Type -AssemblyName System.Web
    $parsed = [Uri]$Uri
    $query = [System.Web.HttpUtility]::ParseQueryString($parsed.Query)
    $rawGame = $query["game"]
    if (-not [string]::IsNullOrWhiteSpace($rawGame)) {
        $gameId = [int]$rawGame
    }
} elseif ($Uri -match '^\d+$') {
    $gameId = [int]$Uri
}

& powershell -NoProfile -ExecutionPolicy Bypass -File $script -GameId $gameId
