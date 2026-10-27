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
    Invoke-WebRequest -Uri "https://www.powershellgallery.com/api/v2/package/$name/$version" -OutFile $archive
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
