# =============================================================================
# Generate Development TLS Certificates (Windows PowerShell)
# =============================================================================
# Creates self-signed certificates for local HTTPS development
# =============================================================================

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$CertsDir = Join-Path $ProjectRoot "certs\dev"

Write-Host "Generating development TLS certificates..."
Write-Host "Output directory: $CertsDir"
Write-Host ""

# Create certs directory
New-Item -ItemType Directory -Force -Path $CertsDir | Out-Null

# Generate self-signed certificate
$cert = New-SelfSignedCertificate `
    -DnsName "localhost", "*.localhost", "sso.jubilee.local" `
    -CertStoreLocation "Cert:\CurrentUser\My" `
    -NotAfter (Get-Date).AddYears(1) `
    -KeyAlgorithm RSA `
    -KeyLength 2048 `
    -HashAlgorithm SHA256 `
    -KeyUsage DigitalSignature, KeyEncipherment `
    -TextExtension @("2.5.29.37={text}1.3.6.1.5.5.7.3.1") `
    -FriendlyName "Jubilee Development"

# Export certificate
$certPath = Join-Path $CertsDir "localhost.crt"
$keyPath = Join-Path $CertsDir "localhost.key"
$pfxPath = Join-Path $CertsDir "localhost.pfx"

# Export as PFX first
$pfxPassword = ConvertTo-SecureString -String "dev-password" -Force -AsPlainText
Export-PfxCertificate -Cert $cert -FilePath $pfxPath -Password $pfxPassword | Out-Null

# Export public certificate
Export-Certificate -Cert $cert -FilePath $certPath -Type CERT | Out-Null

Write-Host ""
Write-Host "Certificates generated successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Files created:"
Write-Host "  $certPath (certificate)"
Write-Host "  $pfxPath (PFX bundle, password: dev-password)"
Write-Host ""
Write-Host "To trust this certificate, run PowerShell as Administrator and execute:"
Write-Host ""
Write-Host "  Import-Certificate -FilePath `"$certPath`" -CertStoreLocation Cert:\LocalMachine\Root"
Write-Host ""
Write-Host "Or manually:"
Write-Host "  1. Double-click $certPath"
Write-Host "  2. Click 'Install Certificate'"
Write-Host "  3. Select 'Local Machine' and click Next"
Write-Host "  4. Select 'Place all certificates in the following store'"
Write-Host "  5. Browse and select 'Trusted Root Certification Authorities'"
Write-Host "  6. Click Next and Finish"
Write-Host ""

# Note: For Node.js, you may need to convert to PEM format using OpenSSL:
Write-Host "For Node.js usage, you may need to convert to PEM format using OpenSSL:" -ForegroundColor Yellow
Write-Host "  openssl pkcs12 -in $pfxPath -nocerts -nodes -out $keyPath"
Write-Host "  openssl pkcs12 -in $pfxPath -nokeys -out $certPath"
Write-Host ""
