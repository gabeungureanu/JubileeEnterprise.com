#!/bin/bash
# Copy Nginx configuration files
# Run as root: sudo ./copy-nginx-files.sh

SRCDIR="/mnt/c/data/JubileeEnterprise.com Bibleweb/infrastructure/wsl2/nginx"

echo "Copying Nginx configuration files..."

# Create upstreams directory
mkdir -p /etc/nginx/upstreams

# Copy files
cp "$SRCDIR/upstreams.conf" /etc/nginx/upstreams/jubilee.conf
cp "$SRCDIR/health.conf" /etc/nginx/sites-available/

# Enable health site
ln -sf /etc/nginx/sites-available/health.conf /etc/nginx/sites-enabled/

# Add include directive to nginx.conf if not present
if ! grep -q "upstreams" /etc/nginx/nginx.conf; then
    sed -i '/http {/a \    include /etc/nginx/upstreams/*.conf;' /etc/nginx/nginx.conf
    echo "Added upstreams include to nginx.conf"
fi

# Test configuration
nginx -t

# Restart Nginx
systemctl restart nginx
systemctl status nginx --no-pager

echo "Nginx configuration complete!"
