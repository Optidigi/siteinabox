#!/usr/bin/env pwsh
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$modules = @(Get-Content -LiteralPath "$PSScriptRoot/modules.json" -Raw | ConvertFrom-Json)
foreach ($module in $modules) {
  $name = [string]$module.name
  $version = [string]$module.version
  $archive = Join-Path ([System.IO.Path]::GetTempPath()) "$name.$version.zip"
  try {
    # This is the official redirect target of the Gallery package API.
    $packageId = $name.ToLowerInvariant()
    Write-Host "Downloading pinned $name $version from the PowerShell Gallery CDN"
    Invoke-WebRequest -Uri "https://cdn.powershellgallery.com/packages/$packageId.$version.nupkg" -OutFile $archive -MaximumRetryCount 2 -RetryIntervalSec 2 -ConnectionTimeoutSeconds 20 -OperationTimeoutSeconds 120
    if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant() -cne [string]$module.sha256) {
      throw "Module checksum mismatch: $name"
    }
    $destination = "/usr/local/share/powershell/Modules/$name/$version"
    Expand-Archive -LiteralPath $archive -DestinationPath $destination
    $manifest = Test-ModuleManifest -Path "$destination/$name.psd1" -ErrorAction Stop
    if ([string]$manifest.Version -cne $version) { throw "Module version mismatch: $name" }
  }
  finally { Remove-Item -LiteralPath $archive -Force -ErrorAction SilentlyContinue }
}
$exchange = $modules | Where-Object name -eq 'ExchangeOnlineManagement'
Import-Module ExchangeOnlineManagement -RequiredVersion $exchange.version -ErrorAction Stop
