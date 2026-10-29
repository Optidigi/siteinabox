param([string]$WorkerPath = "$PSScriptRoot/Invoke-ExchangeWorker.ps1")
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$tokens = $null; $errors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile($WorkerPath, [ref]$tokens, [ref]$errors)
if ($errors.Count) { throw 'Worker syntax errors' }
$jobFunction = $ast.Find({ param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Invoke-ExchangeJob' }, $false)
if (-not $jobFunction) { throw 'Worker job entry point missing' }
# Load the actual job function without starting its HTTP listener. Exchange is
# substituted locally; these tests cannot contact a Microsoft tenant.
. ([scriptblock]::Create($jobFunction.Extent.Text))
function Import-Module { param($Name, $ErrorAction) if ($Name -ne 'ExchangeOnlineManagement') { throw 'Unexpected module' } }
function Connect-ExchangeOnline { param($AccessToken,$UserPrincipalName,$DelegatedOrganization,$ShowBanner,$ShowProgress) if ($AccessToken -ne 'synthetic' -or $UserPrincipalName -ne 'operator@partner.test' -or $DelegatedOrganization -ne 'customer.onmicrosoft.com') { throw 'Unexpected delegated identity' } }
function Disconnect-ExchangeOnline { param($Confirm,$ErrorAction) }
function Get-OrganizationConfig { param($ErrorAction) return @{ Name = 'Synthetic customer' } }
$script:mailboxKind = 'UserMailbox'; $script:mailboxWrites = 0; $script:dkimWrites = 0
function Get-EXOMailbox { param($Identity,$Properties,$ErrorAction) return @{ RecipientTypeDetails = $script:mailboxKind; EmailAddresses = @(); PrimarySmtpAddress = $Identity } }
function Get-EXORecipient { param($Filter,$ErrorAction) return @{ PrimarySmtpAddress = 'someone-else@customer.test' } }
function Set-Mailbox { $script:mailboxWrites++ }
function Get-DkimSigningConfig { param($Identity,$ErrorAction) return @{ Selector1CNAME = 'one.example.test'; Selector2CNAME = 'two.example.test'; Enabled = $false } }
function Set-DkimSigningConfig { $script:dkimWrites++ }
function dig { return 'wrong.example.test.' }
function Assert-ThrowsCode($Operation,$Expected) {
  try { & $Operation; throw 'Expected rejection' }
  catch { if ($_.Exception.Message -ne $Expected) { throw } }
}
$base = @{ customerTenantId = '00000000-0000-0000-0000-000000000001'; customerOrganizationDomain = 'customer.onmicrosoft.com'; domain = 'customer.test'; accessToken = 'synthetic'; partnerUserPrincipalName = 'operator@partner.test' }
$job = $base.Clone(); $job.operation = 'verify_access'
if (-not (Invoke-ExchangeJob ([pscustomobject]$job)).accessVerified) { throw 'Access verification failed' }
$job = $base.Clone(); $job.operation = 'ensure_info_forward'; $job.infoAddress = 'info@customer.test'; $job.forwardTo = 'info@external.test'
Assert-ThrowsCode { Invoke-ExchangeJob ([pscustomobject]$job) } 'existing_info_mailbox_requires_review'
if ($script:mailboxWrites) { throw 'Existing licensed mailbox was modified' }
$job = $base.Clone(); $job.operation = 'ensure_info_alias'; $job.infoAddress = 'info@customer.test'; $job.targetAddress = 'user@customer.test'
Assert-ThrowsCode { Invoke-ExchangeJob ([pscustomobject]$job) } 'info_alias_conflict'
if ($script:mailboxWrites) { throw 'Conflicting alias was modified' }
$job = $base.Clone(); $job.operation = 'enable_dkim'
$result = Invoke-ExchangeJob ([pscustomobject]$job)
if ($result.dkimEnabled -or $result.dkimDnsReady -or -not $result.completed) { throw 'DNS propagation must be a safe waiting result' }
function dig { return $null }
$result = Invoke-ExchangeJob ([pscustomobject]$job)
if ($result.dkimEnabled -or $result.dkimDnsReady -or -not $result.completed) { throw 'Empty DNS response must wait' }
if ($script:dkimWrites) { throw 'DKIM was enabled before DNS resolved' }
$job = $base.Clone(); $job.operation = 'verify_mailboxes'; $job.mailboxAddresses = @('user@other.test')
Assert-ThrowsCode { Invoke-ExchangeJob ([pscustomobject]$job) } 'invalid_mailbox_verification'
Write-Host 'PASS: delegated identity, access read, existing mailbox protection, alias conflict, DKIM DNS gate, mailbox scope'
$job = $base.Clone(); $job.operation = 'ensure_info_shared'; $job.infoAddress = 'info@customer.test'; $job.mailboxAddresses = @('user@customer.test')
Assert-ThrowsCode { Invoke-ExchangeJob ([pscustomobject]$job) } 'existing_info_mailbox_requires_review'
$script:mailboxKind = 'SharedMailbox'
$script:fullAccess = $false; $script:sendAs = $false
function Get-MailboxPermission { param($Identity,$User,$ErrorAction) if ($script:fullAccess) { return @{ AccessRights = @('FullAccess'); Deny = $false } } }
function Add-MailboxPermission { param($Identity,$User,$AccessRights,$InheritanceType,$AutoMapping,$Confirm) $script:fullAccess = $true }
function Get-RecipientPermission { param($Identity,$Trustee,$ErrorAction) if ($script:sendAs) { return @{ AccessRights = @('SendAs'); AccessControlType = 'Allow' } } }
function Add-RecipientPermission { param($Identity,$Trustee,$AccessRights,$Confirm) $script:sendAs = $true }
$result = Invoke-ExchangeJob ([pscustomobject]$job)
if ($result.sharedMailbox -ne 'info@customer.test' -or $result.sharedMailboxMembers[0] -ne 'user@customer.test' -or -not $script:fullAccess -or -not $script:sendAs) { throw 'Shared mailbox permissions missing' }
$job.mailboxAddresses = @('user@other.test')
Assert-ThrowsCode { Invoke-ExchangeJob ([pscustomobject]$job) } 'invalid_shared_mailbox_members'
Write-Host 'PASS: shared inbox requires same-domain users and verifies FullAccess + SendAs'
