$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$zipName = "BugBasher-$timestamp.zip"
Compress-Archive -Path manifest.json,color.png,outline.png -DestinationPath $zipName -Force
Write-Host "Created: $zipName" -ForegroundColor Green
Get-Item $zipName | Select-Object Name,Length,FullName | Format-List
