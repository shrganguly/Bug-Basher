# Package Teams App Script
# Creates a ZIP file ready for Teams installation

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Teams App Packaging Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$appPackageDir = $PSScriptRoot
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$zipFileName = "BugBasher-$timestamp.zip"
$zipPath = Join-Path $appPackageDir $zipFileName

# Check required files
$manifestPath = Join-Path $appPackageDir "manifest-ready.json"
$colorIconPath = Join-Path $appPackageDir "color.png"
$outlineIconPath = Join-Path $appPackageDir "outline.png"

Write-Host "Checking required files..." -ForegroundColor Cyan

$missingFiles = @()

if (-Not (Test-Path $manifestPath)) {
    $missingFiles += "manifest-ready.json"
}

if (-Not (Test-Path $colorIconPath)) {
    $missingFiles += "color.png"
}

if (-Not (Test-Path $outlineIconPath)) {
    $missingFiles += "outline.png"
}

if ($missingFiles.Count -gt 0) {
    Write-Host ""
    Write-Host "ERROR: Missing required files:" -ForegroundColor Red
    foreach ($file in $missingFiles) {
        Write-Host "  - $file" -ForegroundColor Red
    }
    Write-Host ""
    Write-Host "Please ensure all files exist in: $appPackageDir" -ForegroundColor Yellow
    exit 1
}

Write-Host "✓ All required files found!" -ForegroundColor Green
Write-Host ""

# Check if manifest has been updated
$manifestContent = Get-Content $manifestPath -Raw
if ($manifestContent -match "REPLACE_WITH_YOUR_BOT_APP_ID") {
    Write-Host "WARNING: manifest-ready.json still contains placeholder!" -ForegroundColor Yellow
    Write-Host "Please replace 'REPLACE_WITH_YOUR_BOT_APP_ID' with your actual Bot App ID" -ForegroundColor Yellow
    Write-Host ""
    $continue = Read-Host "Continue anyway? (y/n)"
    if ($continue -ne "y" -and $continue -ne "Y") {
        Write-Host "Packaging cancelled." -ForegroundColor Yellow
        exit 0
    }
}

# Create ZIP file
Write-Host "Creating Teams app package..." -ForegroundColor Cyan

# Remove old zip if exists
if (Test-Path $zipPath) {
    Remove-Item $zipPath -Force
}

# Create temporary directory for packaging
$tempDir = Join-Path $env:TEMP "TeamsAppPackage-$timestamp"
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

# Copy files with correct names
Copy-Item $manifestPath (Join-Path $tempDir "manifest.json")
Copy-Item $colorIconPath (Join-Path $tempDir "color.png")
Copy-Item $outlineIconPath (Join-Path $tempDir "outline.png")

# Create ZIP
Compress-Archive -Path "$tempDir\*" -DestinationPath $zipPath -Force

# Cleanup
Remove-Item $tempDir -Recurse -Force

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Teams App Package Created Successfully!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Package location:" -ForegroundColor Cyan
Write-Host "  $zipPath" -ForegroundColor White
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Open Microsoft Teams" -ForegroundColor White
Write-Host "2. Go to Apps → Manage your apps" -ForegroundColor White
Write-Host "3. Click 'Upload a custom app'" -ForegroundColor White
Write-Host "4. Select: $zipFileName" -ForegroundColor White
Write-Host "5. Add to a team or chat to start using!" -ForegroundColor White
Write-Host ""
