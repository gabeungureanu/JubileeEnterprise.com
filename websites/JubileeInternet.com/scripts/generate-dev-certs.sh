#!/bin/bash

# =============================================================================
# Generate Development TLS Certificates
# =============================================================================
# Creates self-signed certificates for local HTTPS development
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CERTS_DIR="$PROJECT_ROOT/certs/dev"

echo "Generating development TLS certificates..."
echo "Output directory: $CERTS_DIR"
echo ""

# Create certs directory
mkdir -p "$CERTS_DIR"

# Generate private key
openssl genrsa -out "$CERTS_DIR/localhost.key" 2048

# Generate certificate signing request
openssl req -new \
    -key "$CERTS_DIR/localhost.key" \
    -out "$CERTS_DIR/localhost.csr" \
    -subj "/C=US/ST=Local/L=Local/O=Jubilee Development/CN=localhost"

# Create extensions file for SAN
cat > "$CERTS_DIR/localhost.ext" << EOF
authorityKeyIdentifier=keyid,issuer
basicConstraints=CA:FALSE
keyUsage = digitalSignature, nonRepudiation, keyEncipherment, dataEncipherment
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
DNS.2 = *.localhost
DNS.3 = sso.jubilee.local
IP.1 = 127.0.0.1
IP.2 = ::1
EOF

# Generate self-signed certificate
openssl x509 -req \
    -in "$CERTS_DIR/localhost.csr" \
    -signkey "$CERTS_DIR/localhost.key" \
    -out "$CERTS_DIR/localhost.crt" \
    -days 365 \
    -sha256 \
    -extfile "$CERTS_DIR/localhost.ext"

# Clean up CSR and ext files
rm "$CERTS_DIR/localhost.csr" "$CERTS_DIR/localhost.ext"

# Set permissions
chmod 600 "$CERTS_DIR/localhost.key"
chmod 644 "$CERTS_DIR/localhost.crt"

echo ""
echo "✓ Certificates generated successfully!"
echo ""
echo "Files created:"
echo "  $CERTS_DIR/localhost.key (private key)"
echo "  $CERTS_DIR/localhost.crt (certificate)"
echo ""
echo "To trust this certificate on your system:"
echo ""
echo "  macOS:"
echo "    sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain $CERTS_DIR/localhost.crt"
echo ""
echo "  Windows (PowerShell as Admin):"
echo "    Import-Certificate -FilePath $CERTS_DIR/localhost.crt -CertStoreLocation Cert:\\LocalMachine\\Root"
echo ""
echo "  Linux:"
echo "    sudo cp $CERTS_DIR/localhost.crt /usr/local/share/ca-certificates/jubilee-localhost.crt"
echo "    sudo update-ca-certificates"
echo ""
