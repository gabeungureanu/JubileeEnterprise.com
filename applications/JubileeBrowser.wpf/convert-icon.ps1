Add-Type -AssemblyName System.Drawing

$sourcePng = "c:\data\JubileeEnterprise.com\applications\JubileeBrowser.wpf\JubileeBrowser.WPF\JubileeBrowser\Resources\Icons\jubilee-logo.png"
$targetIco = "c:\data\JubileeEnterprise.com\applications\JubileeBrowser.wpf\JubileeBrowser.WPF\JubileeBrowser\Resources\Icons\jubilee.ico"

# Load the PNG
$png = [System.Drawing.Image]::FromFile($sourcePng)

# Create multiple sizes for the ICO
$sizes = @(16, 32, 48, 64, 128, 256)

# Create a memory stream for the ICO file
$ms = New-Object System.IO.MemoryStream

# Write ICO header
$writer = New-Object System.IO.BinaryWriter($ms)
$writer.Write([Int16]0)  # Reserved
$writer.Write([Int16]1)  # Type: 1 for ICO
$writer.Write([Int16]$sizes.Count)  # Number of images

# Calculate offsets
$offset = 6 + (16 * $sizes.Count)  # Header + directory entries
$imageData = @()

foreach ($size in $sizes) {
    # Create resized bitmap
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $graphics = [System.Drawing.Graphics]::FromImage($bmp)
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.DrawImage($png, 0, 0, $size, $size)
    $graphics.Dispose()

    # Save to PNG in memory
    $imgMs = New-Object System.IO.MemoryStream
    $bmp.Save($imgMs, [System.Drawing.Imaging.ImageFormat]::Png)
    $imgBytes = $imgMs.ToArray()
    $imageData += ,$imgBytes

    # Write directory entry
    $widthByte = if ($size -ge 256) { 0 } else { $size }
    $heightByte = if ($size -ge 256) { 0 } else { $size }
    $writer.Write([Byte]$widthByte)  # Width (0 = 256)
    $writer.Write([Byte]$heightByte)  # Height
    $writer.Write([Byte]0)  # Color palette
    $writer.Write([Byte]0)  # Reserved
    $writer.Write([Int16]1)  # Color planes
    $writer.Write([Int16]32)  # Bits per pixel
    $writer.Write([Int32]$imgBytes.Length)  # Size of image data
    $writer.Write([Int32]$offset)  # Offset to image data

    $offset += $imgBytes.Length
    $bmp.Dispose()
    $imgMs.Dispose()
}

# Write image data
foreach ($imgBytes in $imageData) {
    $writer.Write($imgBytes)
}

$writer.Flush()
$ms.Position = 0

# Save to file
[System.IO.File]::WriteAllBytes($targetIco, $ms.ToArray())

$ms.Dispose()
$png.Dispose()

Write-Host "ICO file created successfully: $targetIco"
Get-Item $targetIco | Select-Object Name, Length
