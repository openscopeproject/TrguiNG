param(
    [string]$Binary = (Join-Path $PSScriptRoot '..\src-tauri\target\release\TrguiNG.exe'),
    [string]$GeoIp = (Join-Path $PSScriptRoot '..\src-tauri\dbip.mmdb')
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$sha = (git -C $repo rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0) { throw 'Cannot identify build commit.' }
foreach ($file in @($Binary, $GeoIp)) {
    if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { throw "Missing input: $file" }
}
$sourceUrl = if ($env:GITHUB_REPOSITORY) {
    "https://github.com/$env:GITHUB_REPOSITORY"
} else {
    (git -C $repo remote get-url origin).Trim() -replace '^git@github.com:', 'https://github.com/' -replace '\.git$', ''
}
$version = (Get-Content -LiteralPath (Join-Path $repo 'package.json') -Raw | ConvertFrom-Json).version
$name = "TrguiNG-$version-portable-windows-x64-$($sha.Substring(0, 8))"
$output = Join-Path $repo 'portable-output'
$package = Join-Path $output $name
# Do not overwrite an existing package or any user Data directory.
if (Test-Path -LiteralPath $package) { throw "Output already exists: $package" }
$null = New-Item -ItemType Directory -Path (Join-Path $package 'Data') -Force
Copy-Item -LiteralPath $Binary -Destination (Join-Path $package 'TrguiNG.exe')
Copy-Item -LiteralPath $GeoIp -Destination (Join-Path $package 'dbip.mmdb')
Copy-Item -Path (Join-Path $repo 'portable\*') -Destination $package
Copy-Item -LiteralPath (Join-Path $repo 'LICENSE.txt') -Destination $package
[IO.File]::WriteAllText((Join-Path $package 'portable.flag'), '')
$binaryHash = (Get-FileHash -LiteralPath (Join-Path $package 'TrguiNG.exe') -Algorithm SHA256).Hash
$geoHash = (Get-FileHash -LiteralPath (Join-Path $package 'dbip.mmdb') -Algorithm SHA256).Hash
@(
    "Source: $sourceUrl",
    "Commit: $sha",
    "Version: $version (portable fork)",
    "Built UTC: $([DateTime]::UtcNow.ToString('o'))",
    "TrguiNG.exe SHA256: $binaryHash",
    "dbip.mmdb SHA256: $geoHash",
    'WebView2: system runtime; user data in Data\WebView2',
    'GeoIP: DB-IP Country Lite (CC BY 4.0), https://db-ip.com'
) | Set-Content -LiteralPath (Join-Path $package 'BUILD-INFO.txt') -Encoding UTF8
$zip = Join-Path $output ($name + '.zip')
Compress-Archive -LiteralPath $package -DestinationPath $zip -CompressionLevel Optimal
$zipHash = (Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash.ToLowerInvariant()
[IO.File]::WriteAllText(($zip + '.sha256'), "$zipHash  $name.zip`n")
Write-Host "Package: $zip"
Write-Host "SHA256: $zipHash"
