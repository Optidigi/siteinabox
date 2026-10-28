param([Parameter(Mandatory)][string]$InventoryPath)
$ErrorActionPreference = 'Stop'
$fixture = Join-Path ([IO.Path]::GetTempPath()) ('siab-worker-inventory-' + [guid]::NewGuid())
try {
    $runtime = New-Item -ItemType Directory (Join-Path $fixture 'runtime')
    $modules = New-Item -ItemType Directory (Join-Path $fixture 'modules')
    $other = New-Item -ItemType Directory (Join-Path $modules 'alternate-platform')
    $assembly = [object].Assembly.Location
    Copy-Item $assembly (Join-Path $runtime 'example.dll')
    Copy-Item $assembly (Join-Path $other 'example.dll')
    Set-Content (Join-Path $runtime 'example.deps.json') '{"runtimeTarget":{"name":"synthetic"}}'
    Set-Content (Join-Path $modules 'unmapped.dll') 'not a managed assembly'
    $result = (& $InventoryPath -Roots @($runtime.FullName, $modules.FullName) | ConvertFrom-Json)
    if ($result.files.Count -ne 4) { throw 'Inventory omitted a runtime or nested module file' }
    $copies = @($result.files | Where-Object { $_.path.EndsWith('/example.dll') })
    if ($copies.Count -ne 2 -or $copies[0].sha256 -ne $copies[1].sha256) { throw 'Duplicate assembly copies were omitted' }
    if (@($copies | Where-Object { -not $_.assemblyVersion -or -not $_.productVersion }).Count) { throw 'Assembly metadata missing' }
    if (-not ($result.files | Where-Object { $_.path.EndsWith('/unmapped.dll') }).metadataGap) { throw 'Unknown DLL was treated as covered' }
    if ($result.releaseCleared -ne $false) { throw 'Inventory must not grant clearance' }
    $rejected = $false
    try { & $InventoryPath -Roots @((Join-Path $fixture 'absent')) | Out-Null } catch { $rejected = $true }
    if (-not $rejected) { throw 'Missing runtime root was accepted' }
    Write-Output 'Worker runtime inventory contract passed'
} finally { if (Test-Path $fixture) { Remove-Item -Recurse -Force $fixture } }
