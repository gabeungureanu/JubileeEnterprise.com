#!/bin/bash

# =============================================================================
# Generate JWT Signing Keys
# =============================================================================
# Creates RSA key pair for JWT token signing
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "Generating JWT signing keys..."
echo ""

# Generate RSA private key
PRIVATE_KEY=$(openssl genrsa 2048 2>/dev/null)

# Extract public key
PUBLIC_KEY=$(echo "$PRIVATE_KEY" | openssl rsa -pubout 2>/dev/null)

echo "Add these to your .env file:"
echo ""
echo "# JWT Signing Key (Private)"
echo "JWT_SIGNING_KEY=\"$PRIVATE_KEY\""
echo ""
echo "# JWT Public Key"
echo "JWT_PUBLIC_KEY=\"$PUBLIC_KEY\""
echo ""

# Optionally save to files
read -p "Save keys to files? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    KEYS_DIR="$PROJECT_ROOT/.keys"
    mkdir -p "$KEYS_DIR"

    echo "$PRIVATE_KEY" > "$KEYS_DIR/jwt-private.pem"
    echo "$PUBLIC_KEY" > "$KEYS_DIR/jwt-public.pem"

    chmod 600 "$KEYS_DIR/jwt-private.pem"
    chmod 644 "$KEYS_DIR/jwt-public.pem"

    echo ""
    echo "Keys saved to:"
    echo "  $KEYS_DIR/jwt-private.pem"
    echo "  $KEYS_DIR/jwt-public.pem"
    echo ""
    echo "⚠️  WARNING: Add .keys/ to .gitignore if not already present!"
fi
