$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$fixture = Join-Path ([IO.Path]::GetTempPath()) ('trguing-import-test-' + [Guid]::NewGuid().ToString('N'))
$null = New-Item -ItemType Directory -Path $fixture
try {
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot '..\portable\Import-Settings.ps1') -Destination $fixture
    [IO.File]::WriteAllText((Join-Path $fixture 'portable.flag'), '')
    $source = Join-Path $fixture 'original.json'
    [IO.File]::WriteAllText($source, '{"servers":[],"configVersion":1}')
    $original = (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash
    & (Join-Path $fixture 'Import-Settings.ps1') -Source $source
    $destination = Join-Path $fixture 'Data\trguing.json'
    if ((Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash -ne $original) { throw 'Original changed' }
    if ((Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash -ne $original) { throw 'Destination differs' }
    $backups = @(Get-ChildItem -LiteralPath (Join-Path $fixture 'Data\Backups') -File)
    if ($backups.Count -ne 1) { throw 'Expected one backup' }
    if ((Get-FileHash -LiteralPath $backups[0].FullName -Algorithm SHA256).Hash -ne $original) { throw 'Backup differs' }
    $rejected = $false
    try { & (Join-Path $fixture 'Import-Settings.ps1') -Source $source } catch { $rejected = $true }
    if (-not $rejected) { throw 'Existing portable settings were not protected' }
    if ((Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash -ne $original) { throw 'Existing settings changed' }
    Write-Host 'PASS: migration preserves original, creates identical backup, and refuses overwrite.'
} finally {
    Remove-Item -LiteralPath $fixture -Recurse -Force
}
