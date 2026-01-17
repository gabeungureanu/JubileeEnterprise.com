# JubileeOutlook Implementation Status Report PDF Generator
# This script opens the HTML report in Edge and provides instructions to save as PDF

$htmlFile = Join-Path $PSScriptRoot "JubileeOutlook_Implementation_Status_Report.html"
$pdfFile = Join-Path $PSScriptRoot "JubileeOutlook_Implementation_Status_Report.pdf"

Write-Host "============================================" -ForegroundColor Yellow
Write-Host "JubileeOutlook Implementation Status Report" -ForegroundColor Yellow
Write-Host "============================================" -ForegroundColor Yellow
Write-Host ""

if (Test-Path $htmlFile) {
    Write-Host "Opening HTML report in browser..." -ForegroundColor Green
    Write-Host ""
    Write-Host "To save as PDF:" -ForegroundColor Cyan
    Write-Host "  1. Press Ctrl+P to open Print dialog" -ForegroundColor White
    Write-Host "  2. Select 'Microsoft Print to PDF' or 'Save as PDF'" -ForegroundColor White
    Write-Host "  3. Save as: JubileeOutlook_Implementation_Status_Report.pdf" -ForegroundColor White
    Write-Host ""

    # Open in default browser
    Start-Process $htmlFile

    Write-Host "HTML report opened successfully!" -ForegroundColor Green
} else {
    Write-Host "Error: HTML report not found at:" -ForegroundColor Red
    Write-Host "  $htmlFile" -ForegroundColor Red
}

Write-Host ""
Write-Host "Report location: $htmlFile" -ForegroundColor Gray
