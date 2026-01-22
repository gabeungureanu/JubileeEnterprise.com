# Export JubileeChat tables from LocalDB to CSV
$server = "(localdb)\MSSQLLocalDB"
$database = "JubileeChat"
$outputDir = "C:\Temp\JubileeBackup\export"

# Create output directory
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

# Connection string
$connectionString = "Server=$server;Database=$database;Integrated Security=True;TrustServerCertificate=True;"

# Get tables
$conn = New-Object System.Data.SqlClient.SqlConnection($connectionString)
$conn.Open()

$cmd = $conn.CreateCommand()
$cmd.CommandText = "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME"
$reader = $cmd.ExecuteReader()

$tables = @()
while ($reader.Read()) {
    $tables += $reader["TABLE_NAME"]
}
$reader.Close()

Write-Host "Found $($tables.Count) tables to export" -ForegroundColor Green
Write-Host ""

# Export each table
foreach ($table in $tables) {
    try {
        Write-Host "Exporting $table..." -NoNewline

        $cmd = $conn.CreateCommand()
        $cmd.CommandText = "SELECT * FROM [$table]"
        $cmd.CommandTimeout = 300

        $adapter = New-Object System.Data.SqlClient.SqlDataAdapter($cmd)
        $dataset = New-Object System.Data.DataSet
        $adapter.Fill($dataset) | Out-Null

        $rowCount = $dataset.Tables[0].Rows.Count

        if ($rowCount -gt 0) {
            $outputFile = Join-Path $outputDir "$table.csv"
            $dataset.Tables[0] | Export-Csv -Path $outputFile -NoTypeInformation -Encoding UTF8
            Write-Host " $rowCount rows" -ForegroundColor Green
        } else {
            Write-Host " empty" -ForegroundColor Gray
        }
    }
    catch {
        Write-Host " ERROR: $_" -ForegroundColor Red
    }
}

$conn.Close()

Write-Host ""
Write-Host "Export complete! Files saved to: $outputDir" -ForegroundColor Green
