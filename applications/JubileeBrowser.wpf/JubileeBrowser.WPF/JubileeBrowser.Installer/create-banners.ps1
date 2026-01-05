Add-Type -AssemblyName System.Drawing

# Sky blue gradient colors
$skyBlueLight = [System.Drawing.Color]::FromArgb(255, 135, 206, 235)  # Light sky blue
$skyBlueDark = [System.Drawing.Color]::FromArgb(255, 70, 130, 180)   # Steel blue
$white = [System.Drawing.Color]::White

$basePath = "c:\data\JubileeEnterprise.com\applications\JubileeBrowser.wpf\JubileeBrowser.WPF\JubileeBrowser.Installer"

# Create Dialog Background (493x312 pixels)
$dialogWidth = 493
$dialogHeight = 312
$dialog = New-Object System.Drawing.Bitmap($dialogWidth, $dialogHeight)
$dialogGraphics = [System.Drawing.Graphics]::FromImage($dialog)

# Create gradient brush for left panel (first 164 pixels)
$leftPanelWidth = 164
$gradientRect = New-Object System.Drawing.Rectangle(0, 0, $leftPanelWidth, $dialogHeight)
$gradientBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    $gradientRect,
    $skyBlueDark,
    $skyBlueLight,
    [System.Drawing.Drawing2D.LinearGradientMode]::Vertical
)
$dialogGraphics.FillRectangle($gradientBrush, $gradientRect)

# Fill right side with white
$whiteBrush = New-Object System.Drawing.SolidBrush($white)
$dialogGraphics.FillRectangle($whiteBrush, $leftPanelWidth, 0, $dialogWidth - $leftPanelWidth, $dialogHeight)

# Load and draw the Jubilee logo on the left panel
$logoPath = "c:\data\JubileeEnterprise.com\applications\JubileeBrowser.wpf\JubileeBrowser.WPF\JubileeBrowser\Resources\Icons\jubilee-logo.png"
if (Test-Path $logoPath) {
    $logo = [System.Drawing.Image]::FromFile($logoPath)
    $logoSize = 120
    $logoX = ($leftPanelWidth - $logoSize) / 2
    $logoY = 40
    $dialogGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $dialogGraphics.DrawImage($logo, $logoX, $logoY, $logoSize, $logoSize)
    $logo.Dispose()
}

# Add decorative wave/arc at bottom of gradient panel
$pen = New-Object System.Drawing.Pen($skyBlueLight, 3)
$dialogGraphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
for ($i = 0; $i -lt 5; $i++) {
    $yOffset = 200 + ($i * 20)
    $arcPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(50, 255, 255, 255), 2)
    $dialogGraphics.DrawArc($arcPen, -50, $yOffset, $leftPanelWidth + 100, 100, 0, 180)
    $arcPen.Dispose()
}

$dialogGraphics.Dispose()
$dialog.Save("$basePath\dialog.bmp", [System.Drawing.Imaging.ImageFormat]::Bmp)
$dialog.Dispose()
Write-Host "Created dialog.bmp (493x312)"

# Create Banner (493x58 pixels)
$bannerWidth = 493
$bannerHeight = 58
$banner = New-Object System.Drawing.Bitmap($bannerWidth, $bannerHeight)
$bannerGraphics = [System.Drawing.Graphics]::FromImage($banner)

# Create horizontal gradient from sky blue to white
$bannerRect = New-Object System.Drawing.Rectangle(0, 0, $bannerWidth, $bannerHeight)
$bannerBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    $bannerRect,
    $skyBlueDark,
    $white,
    [System.Drawing.Drawing2D.LinearGradientMode]::Horizontal
)
$bannerGraphics.FillRectangle($bannerBrush, $bannerRect)

# Draw small logo on left
if (Test-Path $logoPath) {
    $logo = [System.Drawing.Image]::FromFile($logoPath)
    $logoSize = 44
    $logoX = 7
    $logoY = 7
    $bannerGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $bannerGraphics.DrawImage($logo, $logoX, $logoY, $logoSize, $logoSize)
    $logo.Dispose()
}

$bannerGraphics.Dispose()
$banner.Save("$basePath\banner.bmp", [System.Drawing.Imaging.ImageFormat]::Bmp)
$banner.Dispose()
Write-Host "Created banner.bmp (493x58)"

Write-Host "Banner images created successfully!"
