# Teams Bug Raiser - Deployment Script
# This script helps deploy the bot to Render.com

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Teams Bug Raiser - Deployment Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if git is initialized
if (-Not (Test-Path ".git")) {
    Write-Host "Error: Git repository not initialized!" -ForegroundColor Red
    Write-Host "Run: git init" -ForegroundColor Yellow
    exit 1
}

# Check for uncommitted changes
$gitStatus = git status --porcelain
if ($gitStatus) {
    Write-Host "You have uncommitted changes:" -ForegroundColor Yellow
    Write-Host $gitStatus
    Write-Host ""
    $commit = Read-Host "Do you want to commit these changes? (y/n)"

    if ($commit -eq "y" -or $commit -eq "Y") {
        $commitMessage = Read-Host "Enter commit message"

        Write-Host "Staging changes..." -ForegroundColor Cyan
        git add -A

        Write-Host "Committing..." -ForegroundColor Cyan
        git commit -m "$commitMessage`n`nCo-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"

        Write-Host "Changes committed successfully!" -ForegroundColor Green
    } else {
        Write-Host "Please commit or stash your changes before deploying." -ForegroundColor Yellow
        exit 1
    }
}

# Check if remote is configured
$remoteUrl = git remote get-url origin 2>$null
if (-Not $remoteUrl) {
    Write-Host ""
    Write-Host "No Git remote configured!" -ForegroundColor Yellow
    Write-Host "To deploy to Render, you need to push to GitHub first." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Steps:" -ForegroundColor Cyan
    Write-Host "1. Create a new repository on GitHub" -ForegroundColor White
    Write-Host "2. Run: git remote add origin https://github.com/YOUR-USERNAME/TeamsBugRaiser.git" -ForegroundColor White
    Write-Host "3. Run: git push -u origin main" -ForegroundColor White
    Write-Host "4. Connect the GitHub repo to Render.com" -ForegroundColor White
    Write-Host ""
    exit 1
}

Write-Host "Remote URL: $remoteUrl" -ForegroundColor Green
Write-Host ""

# Get current branch
$currentBranch = git branch --show-current
Write-Host "Current branch: $currentBranch" -ForegroundColor Cyan

# Build the project
Write-Host ""
Write-Host "Building project..." -ForegroundColor Cyan
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Build failed! Please fix errors before deploying." -ForegroundColor Red
    exit 1
}

Write-Host "Build successful!" -ForegroundColor Green

# Push to GitHub
Write-Host ""
$push = Read-Host "Push to GitHub and trigger Render deployment? (y/n)"

if ($push -eq "y" -or $push -eq "Y") {
    Write-Host ""
    Write-Host "Pushing to GitHub..." -ForegroundColor Cyan
    git push origin $currentBranch

    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Green
        Write-Host "Deployment Triggered Successfully!" -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "Next steps:" -ForegroundColor Cyan
        Write-Host "1. Go to Render Dashboard: https://dashboard.render.com" -ForegroundColor White
        Write-Host "2. Check deployment status in your service logs" -ForegroundColor White
        Write-Host "3. Once deployed, test: https://YOUR-SERVICE.onrender.com/health" -ForegroundColor White
        Write-Host ""
        Write-Host "Don't forget to:" -ForegroundColor Yellow
        Write-Host "- Update Bot Framework messaging endpoint" -ForegroundColor White
        Write-Host "- Update Teams app manifest with Render domain" -ForegroundColor White
        Write-Host "- Reinstall Teams app with updated manifest" -ForegroundColor White
        Write-Host ""
        Write-Host "See RENDER_DEPLOYMENT.md for detailed instructions." -ForegroundColor Cyan
        Write-Host ""
    } else {
        Write-Host ""
        Write-Host "Push failed! Check your Git configuration." -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host ""
    Write-Host "Deployment cancelled." -ForegroundColor Yellow
    Write-Host "Run this script again when ready to deploy." -ForegroundColor Yellow
}
