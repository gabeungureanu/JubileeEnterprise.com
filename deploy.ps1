$secpasswd = ConvertTo-SecureString 'askShaddai4e!' -AsPlainText -Force
$cred = New-Object System.Management.Automation.PSCredential('guardian', $secpasswd)
Invoke-Command -ComputerName 20.245.111.91 -Credential $cred -ScriptBlock {
    cd C:/data/JubileeEnterprise.com
    git pull origin main
}
