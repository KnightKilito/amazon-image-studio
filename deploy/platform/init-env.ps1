[CmdletBinding()]
param(
    [string]$Origin = 'http://localhost:8091',
    [string]$OutputPath = ''
)

$ErrorActionPreference = 'Stop'
if (-not $OutputPath) { $OutputPath = Join-Path $PSScriptRoot '.env.local' }
$address = $null
if (-not [Uri]::TryCreate($Origin, [UriKind]::Absolute, [ref]$address) -or
    $address.Scheme -notin @('http', 'https') -or $address.UserInfo -or
    $address.Query -or $address.Fragment -or $address.AbsolutePath -ne '/') {
    throw 'Origin must be an HTTP(S) origin without credentials, path, query or fragment.'
}
$destination = [IO.Path]::GetFullPath($OutputPath)
if (Test-Path -LiteralPath $destination) {
    Write-Host "Configuration already exists; kept unchanged: $destination"
    return
}
if (-not (Test-Path -LiteralPath ([IO.Path]::GetDirectoryName($destination)) -PathType Container)) {
    throw 'The output parent directory must already exist.'
}
function New-RandomSecret {
    $bytes = New-Object byte[] 32
    $generator = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $generator.GetBytes($bytes) } finally { $generator.Dispose() }
    return [Convert]::ToBase64String($bytes)
}
$lines = @(
    '# Private configuration. Back up securely; do not commit or share.'
    "STUDIO_ORIGIN=$($address.GetLeftPart([UriPartial]::Authority))"
    'STUDIO_WEB_PORT=8091'
    'NEW_API_ADMIN_PORT=3003'
    "STUDIO_ENCRYPTION_KEY=$(New-RandomSecret)"
    "NEW_API_SESSION_SECRET=$(New-RandomSecret)"
    '# Placeholder for direct-mode setup only. Align with New API CNY conversion BEFORE wallet use.'
    'STUDIO_QUOTA_PER_CNY=500000'
    'STUDIO_IMAGE_MODEL=gpt-image-2'
    'STUDIO_PLANNER_MODEL=gpt-6.1-sol'
    'STUDIO_PLANNER_API_MODE=responses'
)
# CreateNew also prevents a concurrent invocation from replacing existing secrets.
$stream = [IO.File]::Open($destination, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
try {
    $text = ($lines -join "`n") + "`n"
    $bytes = (New-Object Text.UTF8Encoding($false)).GetBytes($text)
    $stream.Write($bytes, 0, $bytes.Length)
} finally { $stream.Dispose() }
Write-Host "Created configuration: $destination"
Write-Host 'Secrets were generated separately and are not printed. Existing files are never overwritten.'
Write-Host 'Before wallet use, set STUDIO_QUOTA_PER_CNY to the actual New API CNY conversion.'
