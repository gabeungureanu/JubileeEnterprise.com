#!/bin/bash
#
# Jubilee Enterprise WSL2 systemd Services Installer
# ARCH-0007: WSL2 + systemd Architecture
#
# This script installs all systemd unit files and enables services.
# Run from WSL2: sudo ./install-systemd-services.sh
#

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SYSTEMD_DIR="/etc/systemd/system"
WSL2_BASE="/mnt/c/data/JubileeEnterprise.com Bibleweb/infrastructure/wsl2"

echo ""
echo "============================================"
echo "  Jubilee Enterprise systemd Installer"
echo "  ARCH-0007: WSL2 + systemd Architecture"
echo "============================================"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "ERROR: Please run as root (sudo)"
    exit 1
fi

# Check if systemd is running
if [ "$(ps -p 1 -o comm=)" != "systemd" ]; then
    echo "ERROR: systemd is not running as PID 1"
    echo "Enable systemd in /etc/wsl.conf and restart WSL"
    exit 1
fi

echo "Installing systemd unit files..."

# Copy target files
cp "$WSL2_BASE/systemd/jubilee.target" "$SYSTEMD_DIR/"
cp "$WSL2_BASE/systemd/jubilee-docker.target" "$SYSTEMD_DIR/"
cp "$WSL2_BASE/systemd/jubilee-api.target" "$SYSTEMD_DIR/"
cp "$WSL2_BASE/systemd/jubilee-websites.target" "$SYSTEMD_DIR/"

# Copy service files
cp "$WSL2_BASE/systemd/jubilee-docker.service" "$SYSTEMD_DIR/"
cp "$WSL2_BASE/systemd/jubilee-api@.service" "$SYSTEMD_DIR/"
cp "$WSL2_BASE/systemd/jubilee-website@.service" "$SYSTEMD_DIR/"
cp "$WSL2_BASE/systemd/jubilee-cloudflared.service" "$SYSTEMD_DIR/"

echo "  Targets and services copied to $SYSTEMD_DIR"

# Reload systemd
systemctl daemon-reload
echo "  systemd daemon reloaded"

# Create environment directory
mkdir -p /opt/jubilee/env
echo "  Created /opt/jubilee/env"

# Enable targets
systemctl enable jubilee.target
systemctl enable jubilee-docker.target
systemctl enable jubilee-api.target
systemctl enable jubilee-websites.target
echo "  Targets enabled"

# Enable Docker infrastructure service
systemctl enable jubilee-docker.service
echo "  Docker infrastructure service enabled"

# Enable API services
for api in InspireCodex.com InspireContinuum.com InspireFlywheel.com InspireReactors.com; do
    systemctl enable "jubilee-api@${api}.service"
    echo "  Enabled jubilee-api@${api}"
done

# Enable website services (from websites-services.json mapping)
WEBSITES=(
    "JubileeVerse.com"
    "JubileeGoodNews.com"
    "JubileeSearch.com"
    "BibleLujah.com"
    "CelestialPaths.com"
    "GoPartyGiggles.com"
    "InspireShalom.com"
    "jsvBible.com"
    "JubileeAdSpots.com"
    "JubileeBooks.com"
    "JubileeBrowser.com"
    "JubileeCircles.com"
    "JubileeDonations.com"
    "JubileeInspire.com"
    "JubileeMessages.com"
    "JubileeParadox.com"
    "JubileePathfinders.com"
    "JubileePodcasts.com"
    "JubileeSermons.com"
    "JubileeShekels.com"
    "JubileeSmallGroups.com"
    "Jubilee-Software.com"
    "JubileeVibes.com"
    "JubileeWebsites.com"
    "MyTinyTiggles.com"
    "Talk2Characters.com"
    "wwBibleweb.com"
    "JubileeChat.com"
    "JubileeApps.com"
    "JubileeVideos.com"
    "JubileeTunes.com"
    "JubileeOutlook.com"
    "JubileeAIVE.com"
    "JubileeIntelligence.com"
    "InspireWebspaces.com"
    "jixqr.com"
)

for website in "${WEBSITES[@]}"; do
    systemctl enable "jubilee-website@${website}.service"
    echo "  Enabled jubilee-website@${website}"
done

# Enable cloudflared
systemctl enable jubilee-cloudflared.service
echo "  Cloudflared service enabled"

echo ""
echo "============================================"
echo "  Installation Complete!"
echo "============================================"
echo ""
echo "To start all services:"
echo "  sudo systemctl start jubilee.target"
echo ""
echo "To check status:"
echo "  systemctl status jubilee.target"
echo "  systemctl status jubilee-docker.service"
echo "  systemctl list-units 'jubilee-*'"
echo ""
echo "To view logs:"
echo "  journalctl -u jubilee-api@InspireCodex.com -f"
echo ""
