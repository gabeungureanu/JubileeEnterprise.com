# Install Docker in WSL Ubuntu

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  Installing Docker in WSL Ubuntu" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

# Check if WSL Ubuntu is available
try {
    wsl -l -v | Out-Null
    Write-Host "✓ WSL is available" -ForegroundColor Green
} catch {
    Write-Host "✗ WSL is not available" -ForegroundColor Red
    Write-Host "Please run: .\scripts\install-ubuntu.ps1" -ForegroundColor Yellow
    exit 1
}
Write-Host ""

# Create Docker installation script
Write-Host "Creating Docker installation script..." -ForegroundColor Cyan
$dockerInstallScript = @'
#!/bin/bash
set -e

echo "====================================="
echo " Installing Docker in Ubuntu"
echo "====================================="
echo ""

echo "[1/6] Updating package index..."
sudo apt-get update -qq

echo "[2/6] Installing prerequisites..."
sudo apt-get install -y -qq \
    ca-certificates \
    curl \
    gnupg \
    lsb-release

echo "[3/6] Adding Docker GPG key..."
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

echo "[4/6] Setting up Docker repository..."
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

echo "[5/6] Installing Docker Engine..."
sudo apt-get update -qq
sudo apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

echo "[6/6] Starting Docker service..."
sudo service docker start

echo ""
echo "Adding current user to docker group..."
sudo usermod -aG docker $USER

echo ""
echo "====================================="
echo " Docker Installation Complete!"
echo "====================================="
echo ""
docker --version
docker compose version
echo ""
'@

# Save script to WSL
Write-Host "Uploading installation script to WSL..." -ForegroundColor Cyan
$dockerInstallScript | wsl bash -c "cat > /tmp/install-docker.sh && chmod +x /tmp/install-docker.sh"
Write-Host "✓ Script ready" -ForegroundColor Green
Write-Host ""

# Run installation
Write-Host "Running Docker installation (this may take 5-10 minutes)..." -ForegroundColor Yellow
Write-Host ""
wsl bash -c "/tmp/install-docker.sh"

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "==========================================================" -ForegroundColor Cyan
    Write-Host "  ✓ Docker Installation Complete!" -ForegroundColor Green
    Write-Host "==========================================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Verifying installation..." -ForegroundColor Cyan
    wsl bash -c "docker --version"
    wsl bash -c "docker compose version"
    Write-Host ""
    Write-Host "✓ Docker is ready to use" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next step:" -ForegroundColor Cyan
    Write-Host "  .\scripts\setup-wsl-docker-containers.ps1" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "✗ Docker installation failed" -ForegroundColor Red
    Write-Host "Check the error messages above" -ForegroundColor Yellow
    exit 1
}
