$password = ConvertTo-SecureString 'askShaddai4e!' -AsPlainText -Force
$cred = New-Object System.Management.Automation.PSCredential('gungureanu', $password)

try {
    Invoke-Command -ComputerName 20.245.111.91 -Credential $cred -ScriptBlock {
        Set-Location C:\data\JubileeEnterprise.com
        git pull origin main
    }
    Write-Host "Deployment successful!"
} catch {
    Write-Host "PowerShell remoting failed, trying SSH..."
    # Alternative: use plink or native ssh
}
