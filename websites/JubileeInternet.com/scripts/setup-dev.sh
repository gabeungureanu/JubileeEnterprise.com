#!/bin/bash

# =============================================================================
# Development Environment Setup
# =============================================================================
# Complete setup script for new developers
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "=============================================="
echo "  Jubilee SSO - Development Setup"
echo "=============================================="
echo ""

cd "$PROJECT_ROOT"

# Check prerequisites
echo "Checking prerequisites..."

if ! command -v node &> /dev/null; then
    echo "❌ Node.js is required. Please install Node.js 20+."
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo "❌ Node.js 20+ is required. Current version: $(node -v)"
    exit 1
fi
echo "✓ Node.js $(node -v)"

if ! command -v docker &> /dev/null; then
    echo "⚠️  Docker not found. You'll need to set up PostgreSQL manually."
else
    echo "✓ Docker $(docker --version | cut -d' ' -f3)"
fi

if ! command -v openssl &> /dev/null; then
    echo "⚠️  OpenSSL not found. Certificate generation will not work."
else
    echo "✓ OpenSSL $(openssl version | cut -d' ' -f2)"
fi

echo ""

# Install dependencies
echo "Installing dependencies..."
npm install

echo ""

# Copy environment file
if [ ! -f "$PROJECT_ROOT/.env" ]; then
    echo "Creating .env file from template..."
    cp "$PROJECT_ROOT/config/environments/local.env.template" "$PROJECT_ROOT/.env"
    echo "✓ Created .env file"
    echo ""
    echo "⚠️  Please edit .env and configure your environment variables."
    echo "   At minimum, you need to:"
    echo "   1. Generate JWT keys: ./scripts/generate-keys.sh"
    echo "   2. Update DATABASE_URL if not using Docker"
    echo ""
else
    echo "✓ .env file already exists"
fi

# Generate development certificates
if [ ! -f "$PROJECT_ROOT/certs/dev/localhost.crt" ]; then
    echo "Generating development TLS certificates..."
    "$SCRIPT_DIR/generate-dev-certs.sh"
else
    echo "✓ Development certificates already exist"
fi

echo ""

# Start Docker services
if command -v docker &> /dev/null; then
    echo "Starting Docker services..."
    docker-compose -f "$PROJECT_ROOT/infra/docker/docker-compose.dev.yml" up -d

    echo "Waiting for PostgreSQL to be ready..."
    sleep 5

    # Check if PostgreSQL is ready
    for i in {1..30}; do
        if docker exec jubilee-sso-postgres pg_isready -U jubilee_sso -d jubilee_sso_dev &> /dev/null; then
            echo "✓ PostgreSQL is ready"
            break
        fi
        if [ $i -eq 30 ]; then
            echo "❌ PostgreSQL failed to start"
            exit 1
        fi
        sleep 1
    done
fi

echo ""

# Run migrations
echo "Running database migrations..."
cd "$PROJECT_ROOT/services/jubilee-sso"
npm run migrate

echo ""

# Seed development data
echo "Seeding development data..."
npm run seed:dev

echo ""

echo "=============================================="
echo "  Setup Complete!"
echo "=============================================="
echo ""
echo "To start the SSO service:"
echo "  cd services/jubilee-sso && npm run dev"
echo ""
echo "The service will be available at:"
echo "  https://localhost:3000"
echo ""
echo "Test endpoints:"
echo "  https://localhost:3000/health"
echo "  https://localhost:3000/.well-known/openid-configuration"
echo ""
echo "See docs/onboarding.md for more information."
echo ""
