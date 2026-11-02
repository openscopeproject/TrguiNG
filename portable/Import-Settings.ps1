param(
    [string]$Source = (Join-Path ([Environment]::GetFolderPath('ApplicationData')) 'trguing.json')
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if (Get-Process -Name TrguiNG -ErrorAction SilentlyContinue) {
    throw 'Close TrguiNG completely, including the tray icon, before importing settings.'
}
if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'portable.flag') -PathType Leaf)) {
    throw 'portable.flag is missing. Run this script from the extracted portable package.'
}
if (-not (Test-Path -LiteralPath $Source -PathType Leaf)) {
    throw "Configuration file not found: $Source"
}

$data = Join-Path $PSScriptRoot 'Data'
$destination = Join-Path $data 'trguing.json'
if (Test-Path -LiteralPath $destination) {
    throw 'Data\trguing.json already exists. Import cancelled to preserve your portable settings.'
}

# Validate syntax without reserializing or printing credentials.
$contents = [IO.File]::ReadAllText((Resolve-Path -LiteralPath $Source).Path)
$null = ConvertFrom-Json -InputObject $contents
$backups = Join-Path $data 'Backups'
$null = New-Item -ItemType Directory -Path $backups -Force
$backup = Join-Path $backups ('trguing-original-' + [Guid]::NewGuid().ToString('N') + '.json')
Copy-Item -LiteralPath $Source -Destination $backup
Copy-Item -LiteralPath $backup -Destination $destination

$sourceHash = (Get-FileHash -LiteralPath $Source -Algorithm SHA256).Hash
$backupHash = (Get-FileHash -LiteralPath $backup -Algorithm SHA256).Hash
$targetHash = (Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash
if ($sourceHash -ne $backupHash -or $sourceHash -ne $targetHash) {
    throw 'Checksum mismatch. Keep the source and backup files and check the copies before starting TrguiNG.'
}
Write-Host 'Settings copied and SHA-256 verified. The original file was left unchanged.'
Write-Host "Backup: $backup"
Write-Host 'Start TrguiNG.exe from this folder.'
