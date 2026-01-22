# Complete Teams App Setup and Packaging Script
# This will create icons, update manifest, and package everything

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Teams Bug Basher - Complete Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$appPackageDir = $PSScriptRoot

# Step 1: Create placeholder icons
Write-Host "Step 1: Creating app icons..." -ForegroundColor Cyan

try {
    Add-Type -AssemblyName System.Drawing

    # Create 192x192 color icon (orange-red with "BB")
    $colorBitmap = New-Object System.Drawing.Bitmap(192, 192)
    $graphics = [System.Drawing.Graphics]::FromImage($colorBitmap)
    $graphics.Clear([System.Drawing.Color]::FromArgb(216, 59, 1))
    $font = New-Object System.Drawing.Font("Arial", 72, [System.Drawing.FontStyle]::Bold)
    $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $graphics.DrawString("BB", $font, $brush, 30, 45)
    $colorBitmap.Save("$appPackageDir\color.png")
    $graphics.Dispose()
    $colorBitmap.Dispose()
    Write-Host "  ✓ Created color.png" -ForegroundColor Green

    # Create 32x32 outline icon
    $outlineBitmap = New-Object System.Drawing.Bitmap(32, 32)
    $graphics2 = [System.Drawing.Graphics]::FromImage($outlineBitmap)
    $graphics2.Clear([System.Drawing.Color]::Transparent)
    $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::White, 2)
    $graphics2.DrawRectangle($pen, 4, 4, 24, 24)
    $font2 = New-Object System.Drawing.Font("Arial", 10, [System.Drawing.FontStyle]::Bold)
    $brush2 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $graphics2.DrawString("BB", $font2, $brush2, 6, 9)
    $outlineBitmap.Save("$appPackageDir\outline.png")
    $graphics2.Dispose()
    $outlineBitmap.Dispose()
    Write-Host "  ✓ Created outline.png" -ForegroundColor Green
} catch {
    Write-Host "  ⚠ Warning: Could not create icons automatically" -ForegroundColor Yellow
    Write-Host "    You may need to create them manually" -ForegroundColor Yellow
}

Write-Host ""

# Step 2: Update manifest with correct Bot ID
Write-Host "Step 2: Creating production manifest..." -ForegroundColor Cyan

$manifestContent = @"
{
  "`$schema": "https://developer.microsoft.com/en-us/json-schemas/teams/v1.21/MicrosoftTeams.schema.json",
  "manifestVersion": "1.21",
  "version": "1.0.0",
  "id": "6db90f94-dabe-4115-be7b-b8f4837db7c8",
  "developer": {
    "name": "Microsoft OneDrive Team",
    "websiteUrl": "https://teams-bug-raiser.onrender.com",
    "privacyUrl": "https://teams-bug-raiser.onrender.com/privacy",
    "termsOfUseUrl": "https://teams-bug-raiser.onrender.com/terms"
  },
  "icons": {
    "color": "color.png",
    "outline": "outline.png"
  },
  "name": {
    "short": "Bug Basher",
    "full": "Bug Basher - AI-Powered ADO Bug Creation"
  },
  "description": {
    "short": "Automatically create Azure DevOps bugs from Teams messages",
    "full": "Bug Basher is an intelligent Teams bot that automatically creates Azure DevOps bugs by analyzing conversation context using AI. Simply reply to any message containing bug details with '@Bug Basher raise a bug' and the bot will handle the rest."
  },
  "accentColor": "#D83B01",
  "bots": [
    {
      "botId": "6db90f94-dabe-4115-be7b-b8f4837db7c8",
      "scopes": ["personal", "team", "groupChat"],
      "supportsFiles": false,
      "isNotificationOnly": false,
      "commandLists": [
        {
          "scopes": ["personal", "team", "groupChat"],
          "commands": [
            {
              "title": "raise a bug",
              "description": "Create an ADO bug from the message context"
            },
            {
              "title": "create a bug",
              "description": "Create an ADO bug from the message context"
            },
            {
              "title": "report a bug",
              "description": "Create an ADO bug from the message context"
            }
          ]
        }
      ]
    }
  ],
  "permissions": [
    "identity",
    "messageTeamMembers"
  ],
  "validDomains": [
    "teams-bug-raiser.onrender.com"
  ]
}
"@

$manifestContent | Out-File -FilePath "$appPackageDir\manifest.json" -Encoding UTF8
Write-Host "  ✓ Created manifest.json with Bot ID: 6db90f94..." -ForegroundColor Green
Write-Host ""

# Step 3: Package everything
Write-Host "Step 3: Creating Teams app package..." -ForegroundColor Cyan

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$zipFileName = "BugBasher-$timestamp.zip"
$zipPath = Join-Path $appPackageDir $zipFileName

# Check required files
$manifestPath = Join-Path $appPackageDir "manifest.json"
$colorIconPath = Join-Path $appPackageDir "color.png"
$outlineIconPath = Join-Path $appPackageDir "outline.png"

$missingFiles = @()
if (-Not (Test-Path $manifestPath)) { $missingFiles += "manifest.json" }
if (-Not (Test-Path $colorIconPath)) { $missingFiles += "color.png" }
if (-Not (Test-Path $outlineIconPath)) { $missingFiles += "outline.png" }

if ($missingFiles.Count -gt 0) {
    Write-Host ""
    Write-Host "ERROR: Missing required files:" -ForegroundColor Red
    foreach ($file in $missingFiles) {
        Write-Host "  - $file" -ForegroundColor Red
    }
    exit 1
}

# Create temporary directory for packaging
$tempDir = Join-Path $env:TEMP "TeamsAppPackage-$timestamp"
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

# Copy files
Copy-Item $manifestPath (Join-Path $tempDir "manifest.json")
Copy-Item $colorIconPath (Join-Path $tempDir "color.png")
Copy-Item $outlineIconPath (Join-Path $tempDir "outline.png")

# Create ZIP
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
Compress-Archive -Path "$tempDir\*" -DestinationPath $zipPath -Force

# Cleanup
Remove-Item $tempDir -Recurse -Force

Write-Host "  ✓ Created $zipFileName" -ForegroundColor Green
Write-Host ""

Write-Host "========================================" -ForegroundColor Green
Write-Host "Setup Complete! Your app is ready!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Package location:" -ForegroundColor Cyan
Write-Host "  $zipPath" -ForegroundColor White
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Open Microsoft Teams" -ForegroundColor White
Write-Host "2. Click Apps (left sidebar)" -ForegroundColor White
Write-Host "3. Click 'Manage your apps' (bottom left)" -ForegroundColor White
Write-Host "4. Click 'Upload an app' → 'Upload a custom app'" -ForegroundColor White
Write-Host "5. Select: $zipFileName" -ForegroundColor White
Write-Host "6. Click 'Add' to install the bot" -ForegroundColor White
Write-Host "7. Start a chat or add to a team to test!" -ForegroundColor White
Write-Host ""
Write-Host "Bot ID: 6db90f94-dabe-4115-be7b-b8f4837db7c8" -ForegroundColor Gray
Write-Host "Service URL: https://teams-bug-raiser.onrender.com" -ForegroundColor Gray
Write-Host ""
