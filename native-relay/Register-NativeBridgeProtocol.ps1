$ErrorActionPreference = "Stop"

$handler = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "Start-NativeBridgeProtocol.ps1"
$command = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$handler`" `"%1`""
$root = "HKCU:\Software\Classes\v22bridge"

New-Item -Path $root -Force | Out-Null
Set-Item -Path $root -Value "URL:Vortex2+2 Native Bridge"
Set-ItemProperty -Path $root -Name "URL Protocol" -Value ""
New-Item -Path "$root\shell\open\command" -Force | Out-Null
Set-Item -Path "$root\shell\open\command" -Value $command

Write-Host "Registered v22bridge:// protocol handler"
Write-Host $command
