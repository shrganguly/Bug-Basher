# Simple script to create placeholder icons for Teams app
# Run this if you don't have proper icons yet

Write-Host "Creating placeholder icons for Teams app..." -ForegroundColor Cyan

# This will create simple colored squares as placeholders
# For production, replace these with proper bug-themed icons

Add-Type -AssemblyName System.Drawing

# Create 192x192 color icon (red square with "BB" text)
$colorBitmap = New-Object System.Drawing.Bitmap(192, 192)
$graphics = [System.Drawing.Graphics]::FromImage($colorBitmap)
$graphics.Clear([System.Drawing.Color]::FromArgb(216, 59, 1)) # Orange-red color
$font = New-Object System.Drawing.Font("Arial", 72, [System.Drawing.FontStyle]::Bold)
$brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
$graphics.DrawString("BB", $font, $brush, 30, 45)
$colorBitmap.Save("$PSScriptRoot\color.png")
$graphics.Dispose()
$colorBitmap.Dispose()

Write-Host "✓ Created color.png (192x192)" -ForegroundColor Green

# Create 32x32 outline icon (white outline)
$outlineBitmap = New-Object System.Drawing.Bitmap(32, 32)
$graphics2 = [System.Drawing.Graphics]::FromImage($outlineBitmap)
$graphics2.Clear([System.Drawing.Color]::Transparent)
$pen = New-Object System.Drawing.Pen([System.Drawing.Color]::White, 2)
$graphics2.DrawRectangle($pen, 4, 4, 24, 24)
$font2 = New-Object System.Drawing.Font("Arial", 10, [System.Drawing.FontStyle]::Bold)
$brush2 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
$graphics2.DrawString("BB", $font2, $brush2, 6, 9)
$outlineBitmap.Save("$PSScriptRoot\outline.png")
$graphics2.Dispose()
$outlineBitmap.Dispose()

Write-Host "✓ Created outline.png (32x32)" -ForegroundColor Green
Write-Host ""
Write-Host "Placeholder icons created successfully!" -ForegroundColor Green
Write-Host "Located at: $PSScriptRoot" -ForegroundColor Cyan
Write-Host ""
Write-Host "For production, consider creating proper icons with:" -ForegroundColor Yellow
Write-Host "- A bug/ladybug symbol" -ForegroundColor White
Write-Host "- Your organization's branding" -ForegroundColor White
Write-Host "- Professional design tools" -ForegroundColor White
