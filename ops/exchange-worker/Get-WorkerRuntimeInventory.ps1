param([string[]]$Roots = @('/opt/microsoft/powershell/7', '/usr/local/share/powershell/Modules'))
$ErrorActionPreference = 'Stop'
# This is byte/metadata evidence. Vendor package mapping and independent native
# analysis are still required; collecting an inventory never grants clearance.
$paths = foreach ($root in $Roots) {
    if (-not (Test-Path -LiteralPath $root -PathType Container)) { throw "Inventory root missing: $root" }
    Get-ChildItem -LiteralPath $root -Recurse -File -Force
}
$files = foreach ($file in ($paths | Sort-Object FullName -Unique)) {
    $record = [ordered]@{
        path = $file.FullName
        size = $file.Length
        sha256 = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
        assemblyVersion = $null
        fileVersion = $null
        productVersion = $null
        metadataGap = $null
    }
    if ($file.Extension -in @('.dll', '.exe')) {
        $version = [Diagnostics.FileVersionInfo]::GetVersionInfo($file.FullName)
        $record.fileVersion = $version.FileVersion
        $record.productVersion = $version.ProductVersion
        try { $record.assemblyVersion = [Reflection.AssemblyName]::GetAssemblyName($file.FullName).Version.ToString() }
        catch [BadImageFormatException] { $record.metadataGap = 'Not a managed assembly; native/package mapping required' }
    }
    [pscustomobject]$record
}
[ordered]@{
    schemaVersion = 1
    powerShellVersion = $PSVersionTable.PSVersion.ToString()
    framework = [Runtime.InteropServices.RuntimeInformation]::FrameworkDescription
    runtimeIdentifier = [Runtime.InteropServices.RuntimeInformation]::RuntimeIdentifier
    roots = $Roots
    files = @($files)
    releaseCleared = $false
    limitation = 'Hashes and assembly metadata only; package/advisory mapping and independent native coverage remain required.'
} | ConvertTo-Json -Depth 8
