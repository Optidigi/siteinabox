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
        sha256 = $null
        linkTarget = $file.LinkTarget
        assemblyVersion = $null
        fileVersion = $null
        productVersion = $null
        fileKind = 'data'
        metadataGap = $null
    }
    if ($file.LinkTarget -and -not $file.ResolveLinkTarget($true).Exists) {
        # No target bytes exist to analyze. Retain the link rather than inventing
        # a native component or silently omitting the publisher's compatibility link.
        $record.fileKind = 'unresolved-symbolic-link'
        [pscustomobject]$record
        continue
    }
    $record.sha256 = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($file.Extension -in @('.dll', '.exe')) {
        $version = [Diagnostics.FileVersionInfo]::GetVersionInfo($file.FullName)
        $record.fileVersion = $version.FileVersion
        $record.productVersion = $version.ProductVersion
        try {
            $record.assemblyVersion = [Reflection.AssemblyName]::GetAssemblyName($file.FullName).Version.ToString()
            $record.fileKind = 'managed-assembly'
        }
        catch [BadImageFormatException] {
            $record.metadataGap = 'Not a managed assembly; native/package mapping required'
            $stream = [IO.File]::OpenRead($file.FullName)
            try {
                $pe = [Reflection.PortableExecutable.PEReader]::new($stream)
                try {
                    $headers = $pe.PEHeaders
                    if ($headers.PEHeader -and -not $pe.HasMetadata -and
                        $headers.CoffHeader.Machine -in @('I386', 'Amd64', 'Arm64') -and
                        ($headers.CoffHeader.Characteristics -band [Reflection.PortableExecutable.Characteristics]::Dll)) {
                        # Native PE DLLs cannot execute as Linux native libraries.
                        # Managed PE assemblies above remain in .NET coverage.
                        $record.fileKind = 'windows-native-pe'
                        $record.metadataGap = $null
                    }
                } finally { $pe.Dispose() }
            } catch [BadImageFormatException] { } finally { $stream.Dispose() }
        }
    }
    [pscustomobject]$record
}
$assemblyBindings = @()
$workerEntryPointSha256 = $null
if ($Roots -contains '/opt/microsoft/powershell/7' -and $Roots -contains '/usr/local/share/powershell/Modules') {
    $workerEntryPointSha256 = (Get-FileHash /app/Invoke-ExchangeWorker.ps1 -Algorithm SHA256).Hash.ToLowerInvariant()
    # Exercise the same module import as the worker, without a Microsoft connection.
    Import-Module ExchangeOnlineManagement -ErrorAction Stop
    $module = Get-Module ExchangeOnlineManagement
    $requestedPath = Join-Path $module.ModuleBase 'netCore/System.Security.Cryptography.Pkcs.dll'
    $resolved = [Reflection.Assembly]::LoadFrom($requestedPath)
    $assemblyBindings = @([ordered]@{
        requestedPath = $requestedPath
        requestedSha256 = (Get-FileHash $requestedPath -Algorithm SHA256).Hash.ToLowerInvariant()
        resolvedPath = $resolved.Location
        resolvedSha256 = (Get-FileHash $resolved.Location -Algorithm SHA256).Hash.ToLowerInvariant()
        productVersion = [Diagnostics.FileVersionInfo]::GetVersionInfo($resolved.Location).ProductVersion
        context = [Runtime.Loader.AssemblyLoadContext]::GetLoadContext($resolved).Name
        loadedPaths = @([Runtime.Loader.AssemblyLoadContext]::All | ForEach-Object { $_.Assemblies } |
            Where-Object { $_.GetName().Name -eq 'System.Security.Cryptography.Pkcs' } | ForEach-Object { $_.Location } | Sort-Object -Unique)
    })
}
[ordered]@{
    schemaVersion = 1
    powerShellVersion = $PSVersionTable.PSVersion.ToString()
    framework = [Runtime.InteropServices.RuntimeInformation]::FrameworkDescription
    runtimeIdentifier = [Runtime.InteropServices.RuntimeInformation]::RuntimeIdentifier
    roots = $Roots
    files = @($files)
    assemblyBindings = $assemblyBindings
    workerEntryPointSha256 = $workerEntryPointSha256
    releaseCleared = $false
    limitation = 'Hashes and assembly metadata only; package/advisory mapping and independent native coverage remain required.'
} | ConvertTo-Json -Depth 8
