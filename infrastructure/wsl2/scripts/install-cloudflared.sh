#!/bin/bash
#
# Install cloudflared in WSL2
# ARCH-0007: WSL2 + systemd Architecture
#
# Run in WSL2: sudo ./install-cloudflared.sh
#

set -e

echo ""
echo "============================================"
echo "  Installing cloudflared for WSL2"
echo "  ARCH-0007: WSL2 + systemd Architecture"
echo "============================================"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "ERROR: Please run as root (sudo)"
    exit 1
fi

# Detect architecture
ARCH=$(dpkg --print-architecture)
echo "Detected architecture: $ARCH"

# Download cloudflared
echo "Downloading cloudflared..."
case $ARCH in
    amd64)
        curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared
        ;;
    arm64)
        curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64 -o /usr/local/bin/cloudflared
        ;;
    *)
        echo "ERROR: Unsupported architecture: $ARCH"
        exit 1
        ;;
esac

# Make executable
chmod +x /usr/local/bin/cloudflared

# Verify installation
echo ""
echo "Verifying installation..."
/usr/local/bin/cloudflared --version

# Create cloudflared config directory for user
USER_HOME=$(eval echo ~$SUDO_USER)
CLOUDFLARED_DIR="$USER_HOME/.cloudflared"

if [ ! -d "$CLOUDFLARED_DIR" ]; then
    mkdir -p "$CLOUDFLARED_DIR"
    chown $SUDO_USER:$SUDO_USER "$CLOUDFLARED_DIR"
    echo "Created $CLOUDFLARED_DIR"
fi

# Copy config from Windows if it exists
WINDOWS_CONFIG="/mnt/c/Users/elian/.cloudflared/config.yml"
WINDOWS_CREDS="/mnt/c/Users/elian/.cloudflared/c4c875e2-55a9-4ad7-a0e9-36c391229c0b.json"

if [ -f "$WINDOWS_CONFIG" ]; then
    echo "Copying config.yml from Windows..."
    cp "$WINDOWS_CONFIG" "$CLOUDFLARED_DIR/config.yml"
    chown $SUDO_USER:$SUDO_USER "$CLOUDFLARED_DIR/config.yml"
fi

if [ -f "$WINDOWS_CREDS" ]; then
    echo "Copying credentials from Windows..."
    cp "$WINDOWS_CREDS" "$CLOUDFLARED_DIR/"
    chown $SUDO_USER:$SUDO_USER "$CLOUDFLARED_DIR/"*.json

    # Update credentials path in config
    sed -i "s|C:\\\\Users\\\\elian\\\\.cloudflared|$CLOUDFLARED_DIR|g" "$CLOUDFLARED_DIR/config.yml"
fi

echo ""
echo "============================================"
echo "  cloudflared installed successfully!"
echo "============================================"
echo ""
echo "Version: $(/usr/local/bin/cloudflared --version)"
echo "Config directory: $CLOUDFLARED_DIR"
echo ""
echo "To test the tunnel:"
echo "  cloudflared tunnel info jubilee-enterprise"
echo ""
echo "To run the tunnel:"
echo "  cloudflared tunnel run jubilee-enterprise"
echo ""
echo "The systemd service (jubilee-cloudflared.service) will manage this automatically."
echo ""
