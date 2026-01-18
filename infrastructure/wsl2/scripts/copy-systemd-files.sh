#!/bin/bash
# Copy systemd files to /etc/systemd/system
# Run as root: sudo ./copy-systemd-files.sh

SRCDIR="/mnt/c/data/JubileeEnterprise.com Bibleweb/infrastructure/wsl2/systemd"

echo "Copying systemd files from: $SRCDIR"
echo "To: /etc/systemd/system/"

cp "$SRCDIR/jubilee.target" /etc/systemd/system/
cp "$SRCDIR/jubilee-docker.target" /etc/systemd/system/
cp "$SRCDIR/jubilee-api.target" /etc/systemd/system/
cp "$SRCDIR/jubilee-websites.target" /etc/systemd/system/
cp "$SRCDIR/jubilee-docker.service" /etc/systemd/system/
cp "$SRCDIR/jubilee-api@.service" /etc/systemd/system/
cp "$SRCDIR/jubilee-website@.service" /etc/systemd/system/
cp "$SRCDIR/jubilee-cloudflared.service" /etc/systemd/system/

echo "Reloading systemd..."
systemctl daemon-reload

echo "Enabling services..."
systemctl enable jubilee.target
systemctl enable jubilee-docker.target
systemctl enable jubilee-api.target
systemctl enable jubilee-websites.target
systemctl enable jubilee-docker.service

echo "Done! Files installed:"
ls -la /etc/systemd/system/jubilee*
