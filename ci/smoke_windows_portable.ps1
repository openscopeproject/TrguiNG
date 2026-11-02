$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$packages = @(Get-ChildItem -LiteralPath (Join-Path $repo 'portable-output') -Directory)
if ($packages.Count -ne 1) { throw 'Expected one portable package.' }
$diagnostics = Join-Path $repo 'portable-output\smoke-diagnostics'
$null = New-Item -ItemType Directory -Path $diagnostics -Force
$fixture = Join-Path ([IO.Path]::GetTempPath()) ('TrguiNG portable smoke ' + [Guid]::NewGuid().ToString('N'))
$root = Join-Path $fixture 'First location'
$null = New-Item -ItemType Directory -Path $fixture
$roaming = Join-Path ([Environment]::GetFolderPath('ApplicationData')) 'trguing.json'
$originalHash = if (Test-Path -LiteralPath $roaming) { (Get-FileHash -LiteralPath $roaming).Hash } else { $null }
$process = $null
try {
    Copy-Item -LiteralPath $packages[0].FullName -Destination $root -Recurse
    $config = Join-Path $root 'Data\trguing.json'
    # The argument listener is mounted only when a server tab is open. Use an
    # unreachable loopback endpoint, never a real daemon or user credentials.
    $settings = @{
        servers = @(@{
            name = 'Portable smoke'
            connection = @{ url = 'http://127.0.0.1:9/transmission/rpc'; username = ''; password = '' }
            pathMappings = @(); expandedDirFilters = @(); lastSaveDirs = @()
            intervals = @{ session = 60; torrents = 60; torrentsMinimized = 60; details = 60 }
        })
        configVersion = 1
        app = @{ onClose = 'quit'; showTrayIcon = $false; openTabs = @('Portable smoke'); lastTab = 0 }
        interface = @{ theme = 'dark' }
    }
    [IO.File]::WriteAllText($config, ($settings | ConvertTo-Json -Depth 8))
    foreach ($attempt in 1..2) {
        Write-Host "Starting portable GUI, attempt $attempt"
        $process = Start-Process -FilePath (Join-Path $root 'TrguiNG.exe') -WorkingDirectory $fixture -PassThru -RedirectStandardOutput (Join-Path $diagnostics "stdout-$attempt.txt") -RedirectStandardError (Join-Path $diagnostics "stderr-$attempt.txt")
        $ready = $false
        foreach ($retry in 1..20) {
            if ($process.HasExited) { throw "TrguiNG exited before becoming ready: $($process.ExitCode)" }
            try {
                $response = Invoke-WebRequest 'http://127.0.0.1:44321/args' -Method Post -ContentType 'application/json' -Body '[]' -TimeoutSec 3 -NoProxy
                if ($response.StatusCode -eq 200) { $ready = $true; break }
            } catch {
                Write-Host "Readiness attempt ${retry}: $($_.Exception.Message)"
                Start-Sleep -Seconds 1
            }
        }
        if (-not $ready) { throw 'The frontend did not signal readiness.' }
        Write-Host 'Frontend argument listener is ready.'
        $process.Refresh()
        if (-not $process.CloseMainWindow()) { throw 'Unable to close the application window.' }
        if (-not $process.WaitForExit(20000)) { throw 'Application did not finish saving and exit.' }
        if ($process.ExitCode -ne 0) { throw "Application exit code: $($process.ExitCode)" }
        $saved = Get-Content -LiteralPath (Join-Path $root 'Data\trguing.json') -Raw | ConvertFrom-Json
        if ($saved.interface.theme -ne 'dark' -or $null -eq $saved.interface.filterSections) { throw 'Portable configuration was not read and saved.' }
        if (@(Get-ChildItem -LiteralPath (Join-Path $root 'Data\WebView2') -Force).Count -eq 0) { throw 'WebView2 profile was not created inside Data.' }
        $afterHash = if (Test-Path -LiteralPath $roaming) { (Get-FileHash -LiteralPath $roaming).Hash } else { $null }
        if ($afterHash -ne $originalHash) { throw 'Application changed the installed configuration.' }
        Write-Host "Attempt ${attempt}: portable configuration and WebView2 profile verified."
        if ($attempt -eq 1) {
            # WebView2 processes can take a moment to release the profile after exit.
            $moved = Join-Path $fixture 'Moved location'
            foreach ($retry in 1..30) {
                try { [IO.Directory]::Move($root, $moved); break } catch {
                    if ($retry -eq 30) { throw }
                    Start-Sleep -Seconds 1
                }
            }
            $root = $moved
        }
    }
    Write-Host 'PASS: Windows GUI starts, reads/saves portable settings, uses portable WebView2 data, and survives relocation.'
} finally {
    if ($null -ne $process -and -not $process.HasExited) { Stop-Process -Id $process.Id -Force }
    Remove-Item -LiteralPath $fixture -Recurse -Force -ErrorAction SilentlyContinue
}
