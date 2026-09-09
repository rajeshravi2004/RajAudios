param(
    [string]$Config = 'config/production.json',
    [switch]$SplitPerAbi
)
$ErrorActionPreference = 'Stop'
$projectDirectory = Split-Path -Parent $PSScriptRoot
Push-Location $projectDirectory
try {
    if (-not (Get-Command flutter -ErrorAction SilentlyContinue)) {
        throw 'Install Flutter 3.47.2 or newer and add flutter/bin to PATH first.'
    }
    if (-not (Test-Path -LiteralPath $Config)) { throw "Configuration not found: $Config" }
    & flutter pub get
    if ($LASTEXITCODE -ne 0) { throw 'Flutter dependency resolution failed.' }
    & flutter analyze
    if ($LASTEXITCODE -ne 0) { throw 'Flutter analysis failed.' }
    & flutter test
    if ($LASTEXITCODE -ne 0) { throw 'Flutter tests failed.' }
    $buildArguments = @('build', 'apk', '--release', "--dart-define-from-file=$Config")
    if ($SplitPerAbi) { $buildArguments += '--split-per-abi' }
    & flutter @buildArguments
    if ($LASTEXITCODE -ne 0) { throw 'Android APK build failed.' }
    $downloadDirectory = Join-Path (Split-Path -Parent $projectDirectory) 'downloads'
    New-Item -ItemType Directory -Path $downloadDirectory -Force | Out-Null
    Get-ChildItem -LiteralPath 'build/app/outputs/flutter-apk' -Filter '*release.apk' | ForEach-Object {
        $fileName = $_.Name.Replace('app-', 'rajify-android-')
        $destination = Join-Path $downloadDirectory $fileName
        Copy-Item -LiteralPath $_.FullName -Destination $destination
        $hash = (Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash.ToLowerInvariant()
        "$hash  $fileName" | Set-Content -LiteralPath "$destination.sha256" -Encoding ascii
        Write-Output "APK ready: $destination"
    }
    if (-not (Test-Path -LiteralPath 'android/key.properties')) {
        Write-Output 'This APK uses debug signing for testing. Configure android/key.properties for stable release signing.'
    }
} finally {
    Pop-Location
}
