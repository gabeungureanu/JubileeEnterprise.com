$response = Invoke-WebRequest -Uri 'http://localhost:3101/api/v1/outlook/folders' -Headers @{'X-User-Id'='00000000-0000-0000-0000-000000000001'} -UseBasicParsing
Write-Host "Status:" $response.StatusCode
$json = $response.Content | ConvertFrom-Json
Write-Host "Folders count:" $json.folders.Count
$json.folders | ForEach-Object { Write-Host "  -" $_.name "(Type:" $_.folder_type ")" }
