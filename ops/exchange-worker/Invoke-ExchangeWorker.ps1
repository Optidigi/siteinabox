#!/usr/bin/env pwsh
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Send-Json($Context, [int]$Status, $Body) {
  $bytes = [System.Text.Encoding]::UTF8.GetBytes(($Body | ConvertTo-Json -Depth 8 -Compress))
  $Context.Response.StatusCode = $Status
  $Context.Response.ContentType = 'application/json; charset=utf-8'
  $Context.Response.ContentLength64 = $bytes.Length
  $Context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
  $Context.Response.Close()
}

function Invoke-ExchangeJob($Job) {
  $tenantId = [string]$Job.customerTenantId
  $organizationDomain = ([string]$Job.customerOrganizationDomain).Trim().ToLowerInvariant()
  $domain = ([string]$Job.domain).Trim().ToLowerInvariant()
  if ($tenantId -notmatch '^[0-9a-fA-F-]{36}$' -or $organizationDomain -notmatch '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.onmicrosoft\.com$' -or $domain -notmatch '^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$') {
    throw 'invalid_job'
  }

  Import-Module ExchangeOnlineManagement -ErrorAction Stop
  $partnerUpn = ([string]$Job.partnerUserPrincipalName).Trim()
  if ($partnerUpn -notmatch '^[^\s@]+@[^\s@]+\.[^\s@]+$') { throw 'invalid_partner_identity' }
  Connect-ExchangeOnline -AccessToken ([string]$Job.accessToken) -UserPrincipalName $partnerUpn -DelegatedOrganization $organizationDomain -ShowBanner:$false -ShowProgress:$false
  try {
    if ($Job.operation -eq 'verify_access') {
      Get-OrganizationConfig -ErrorAction Stop | Out-Null
      return @{ operation = $Job.operation; completed = $true; accessVerified = $true }
    }
    if ($Job.operation -eq 'verify_mailboxes') {
      $addresses = @($Job.mailboxAddresses)
      if ($addresses.Count -lt 1 -or $addresses.Count -gt 300) { throw 'invalid_mailbox_verification' }
      $ready = $true
      foreach ($address in $addresses) {
        $mailboxAddress = [System.Net.Mail.MailAddress]::new([string]$address)
        if ($mailboxAddress.Host -cne $domain -or $mailboxAddress.Address -cne [string]$address) { throw 'invalid_mailbox_verification' }
        if (-not (Get-EXOMailbox -Identity ([string]$address) -ErrorAction SilentlyContinue)) { $ready = $false }
      }
      return @{ operation = $Job.operation; completed = $true; mailboxesReady = $ready }
    }
    if ($Job.operation -eq 'ensure_info_forward') {
      $mailbox = ([string]$Job.infoAddress).Trim().ToLowerInvariant()
      $forward = ([string]$Job.forwardTo).Trim().ToLowerInvariant()
      $forwardIsValid = $false
      try { $forwardIsValid = ([System.Net.Mail.MailAddress]::new($forward).Address -ceq $forward) } catch { }
      if ($mailbox -ne "info@$domain" -or $forward.Length -gt 254 -or -not $forwardIsValid) { throw 'invalid_forwarding_request' }

      $existing = Get-EXOMailbox -Identity $mailbox -ErrorAction SilentlyContinue
      if (-not $existing) { New-Mailbox -Shared -Name "info@$domain" -DisplayName "Info ($domain)" -PrimarySmtpAddress $mailbox | Out-Null }
      elseif ([string]$existing.RecipientTypeDetails -ne 'SharedMailbox') { throw 'existing_info_mailbox_requires_review' }
      Set-Mailbox -Identity $mailbox -ForwardingSmtpAddress $forward -DeliverToMailboxAndForward $true

      $policyName = 'Siteinabox-InfoForward-Allow'
      $policy = Get-HostedOutboundSpamFilterPolicy -Identity $policyName -ErrorAction SilentlyContinue
      if (-not $policy) { New-HostedOutboundSpamFilterPolicy -Name $policyName -AutoForwardingMode On | Out-Null }
      else { Set-HostedOutboundSpamFilterPolicy -Identity $policyName -AutoForwardingMode On }
      $rule = Get-HostedOutboundSpamFilterRule -Identity $policyName -ErrorAction SilentlyContinue
      if (-not $rule) { New-HostedOutboundSpamFilterRule -Name $policyName -HostedOutboundSpamFilterPolicy $policyName -From $mailbox -Priority 0 | Out-Null }
      else { Set-HostedOutboundSpamFilterRule -Identity $policyName -From $mailbox }

      return @{ operation = $Job.operation; completed = $true; sharedMailbox = $mailbox; forwardingAddress = $forward }
    }

    if ($Job.operation -eq 'ensure_info_alias') {
      $alias = ([string]$Job.infoAddress).Trim().ToLowerInvariant()
      $target = ([string]$Job.targetAddress).Trim().ToLowerInvariant()
      $targetIsValid = $false
      try {
        $parsedTarget = [System.Net.Mail.MailAddress]::new($target)
        $targetIsValid = $parsedTarget.Address -ceq $target -and $parsedTarget.Host -ceq $domain
      } catch { }
      if ($alias -ne "info@$domain" -or -not $targetIsValid) { throw 'invalid_info_alias_request' }

      $targetMailbox = $null
      for ($attempt = 0; $attempt -lt 10 -and -not $targetMailbox; $attempt++) {
        $targetMailbox = Get-EXOMailbox -Identity $target -Properties EmailAddresses -ErrorAction SilentlyContinue
        if (-not $targetMailbox -and $attempt -lt 9) { Start-Sleep -Seconds 5 }
      }
      if (-not $targetMailbox) { throw 'info_alias_target_missing' }
      $existingAlias = Get-EXORecipient -Filter "EmailAddresses -eq 'smtp:$alias'" -ErrorAction SilentlyContinue
      if ($existingAlias -and ([string]$existingAlias.PrimarySmtpAddress).ToLowerInvariant() -ne $target) {
        throw 'info_alias_conflict'
      }
      if (-not $existingAlias) { Set-Mailbox -Identity $target -EmailAddresses @{ Add = "smtp:$alias" } }
      return @{ operation = $Job.operation; completed = $true; alias = $alias; aliasTarget = $target }
    }

    if ($Job.operation -eq 'get_dkim_targets' -or $Job.operation -eq 'enable_dkim') {
      $config = Get-DkimSigningConfig -Identity $domain -ErrorAction SilentlyContinue
      if (-not $config) { New-DkimSigningConfig -DomainName $domain -Enabled $false | Out-Null; $config = Get-DkimSigningConfig -Identity $domain }
      if (-not $config.Selector1CNAME -or -not $config.Selector2CNAME) { throw 'dkim_targets_unavailable' }
      $records = @(
        @{ selector = 'selector1'; target = [string]$config.Selector1CNAME },
        @{ selector = 'selector2'; target = [string]$config.Selector2CNAME }
      )
      if ($Job.operation -eq 'get_dkim_targets') {
        return @{ operation = $Job.operation; completed = $true; dkimEnabled = [bool]$config.Enabled; dkimRecords = $records }
      }
      foreach ($record in $records) {
        $resolved = ([string](& dig +short CNAME "$($record.selector)._domainkey.$domain" 2>$null | Select-Object -First 1)).Trim().TrimEnd('.').ToLowerInvariant()
        if ($resolved -ne ([string]$record.target).Trim().TrimEnd('.').ToLowerInvariant()) { return @{ operation = $Job.operation; completed = $true; dkimEnabled = $false; dkimDnsReady = $false; dkimRecords = $records } }
      }
      if (-not $config.Enabled) { Set-DkimSigningConfig -Identity $domain -Enabled $true }
      return @{ operation = $Job.operation; completed = $true; dkimEnabled = $true; dkimRecords = $records }
    }
    throw 'unsupported_operation'
  }
  finally { Disconnect-ExchangeOnline -Confirm:$false -ErrorAction SilentlyContinue }
}

$listenUrl = [Environment]::GetEnvironmentVariable('EXCHANGE_WORKER_LISTEN_URL')
$sharedSecret = [Environment]::GetEnvironmentVariable('EXCHANGE_WORKER_SHARED_SECRET')
if (-not $listenUrl -or -not $sharedSecret -or $sharedSecret.Length -lt 32) { throw 'worker_configuration_invalid' }
$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add($listenUrl)
$listener.Start()
Write-Host "Exchange worker listening at $listenUrl"
while ($listener.IsListening) {
  $context = $listener.GetContext()
  try {
    $path = $context.Request.Url.AbsolutePath
    $healthRequest = $context.Request.HttpMethod -eq 'GET' -and $path -eq '/health'
    $jobRequest = $context.Request.HttpMethod -eq 'POST' -and $path -eq '/jobs'
    if (-not $healthRequest -and -not $jobRequest) { Send-Json $context 404 @{ code = 'not_found' }; continue }
    $authorization = $context.Request.Headers['Authorization']
    $provided = if ($authorization -like 'Bearer *') { $authorization.Substring(7) } else { '' }
    $left = [System.Text.Encoding]::UTF8.GetBytes($provided)
    $right = [System.Text.Encoding]::UTF8.GetBytes($sharedSecret)
    if ($left.Length -ne $right.Length -or -not [System.Security.Cryptography.CryptographicOperations]::FixedTimeEquals($left, $right)) { Send-Json $context 401 @{ code = 'unauthorized' }; continue }
    if ($healthRequest) {
      $module = Get-Module -ListAvailable -Name ExchangeOnlineManagement | Sort-Object Version -Descending | Select-Object -First 1
      $dnsTool = Get-Command dig -ErrorAction SilentlyContinue
      $healthy = [bool]$module -and [bool]$dnsTool
      $healthStatus = if ($healthy) { 200 } else { 503 }
      $moduleVersion = if ($module) { [string]$module.Version } else { '' }
      Send-Json $context $healthStatus @{ healthy = $healthy; protocolVersion = 1; moduleVersion = $moduleVersion; dnsToolAvailable = [bool]$dnsTool }
      continue
    }
    if ($context.Request.ContentType -notlike 'application/json*') { Send-Json $context 415 @{ code = 'content_type_required' }; continue }
    if ($context.Request.ContentLength64 -lt 1 -or $context.Request.ContentLength64 -gt 131072) { Send-Json $context 413 @{ code = 'payload_size_invalid' }; continue }
    $reader = [System.IO.StreamReader]::new($context.Request.InputStream)
    $job = $reader.ReadToEnd() | ConvertFrom-Json
    $result = Invoke-ExchangeJob $job
    Send-Json $context 200 $result
  }
  catch {
    # Deliberately do not return cmdlet text, tokens, identities, or exception details.
    $code = if ($_.Exception.Message -match '^[a-z_]+$') { $_.Exception.Message } else { 'exchange_command_failed' }
    try { Send-Json $context 502 @{ code = $code } } catch { }
  }
}
