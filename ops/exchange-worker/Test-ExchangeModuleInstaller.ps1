param([string]$InstallerPath = "$PSScriptRoot/Install-ExchangeModules.ps1")
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$testDirectory = Join-Path ([System.IO.Path]::GetTempPath()) ('worker-installer-test-' + [guid]::NewGuid())
New-Item -ItemType Directory -Path $testDirectory | Out-Null
$script:downloadPath = $null
$script:extractionAttempted = $false
function Invoke-WebRequest {
  param($Uri, $OutFile, $MaximumRetryCount, $RetryIntervalSec, $ConnectionTimeoutSeconds, $OperationTimeoutSeconds)
  if (([uri]$Uri).Scheme -ne 'https' -or ([uri]$Uri).Host -ne 'cdn.powershellgallery.com') { throw 'Unexpected download source' }
  if ($MaximumRetryCount -lt 1 -or $MaximumRetryCount -gt 3 -or $ConnectionTimeoutSeconds -gt 30 -or $OperationTimeoutSeconds -gt 180) { throw 'Download must be bounded' }
  $script:downloadPath = $OutFile
  [System.IO.File]::WriteAllText($OutFile, 'intentionally incorrect package bytes')
}
function Expand-Archive { $script:extractionAttempted = $true; throw 'Unverified bytes reached extraction' }
try {
  Copy-Item -LiteralPath $InstallerPath -Destination "$testDirectory/Install-ExchangeModules.ps1"
  Copy-Item -LiteralPath (Join-Path (Split-Path $InstallerPath) 'modules.json') -Destination "$testDirectory/modules.json"
  try {
    . "$testDirectory/Install-ExchangeModules.ps1"
    throw 'Checksum mismatch was accepted'
  } catch {
    if ($_.Exception.Message -notlike 'Module checksum mismatch: *') { throw }
  }
  if (-not $script:downloadPath -or $script:extractionAttempted -or (Test-Path -LiteralPath $script:downloadPath)) { throw 'Installer did not reject and clean up unverified bytes' }
  Write-Host 'PASS: official CDN, bounded download, checksum rejection before extraction and cleanup'
} finally { Remove-Item -LiteralPath $testDirectory -Recurse -Force }
