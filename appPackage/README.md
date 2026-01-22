# Teams App Package

This directory contains the Teams app manifest and icons.

## Setup Instructions

### 1. Replace Placeholders in manifest.json

Edit `manifest.json` and replace:
- `{{REPLACE_WITH_YOUR_BOT_APP_ID}}` - Your Bot Framework App ID (same as MICROSOFT_APP_ID)
- `{{REPLACE_WITH_YOUR_DOMAIN}}` - Your bot hosting domain (e.g., your-app.azurewebsites.net)

### 2. Create Icon Images

You need to create two icon images:

**color.png** - 192x192 pixels
- Full color icon shown in Teams app list
- Should clearly represent a bug or issue tracking

**outline.png** - 32x32 pixels
- Single color (white) outline on transparent background
- Simplified version of the color icon

You can use any graphic design tool or online icon generator to create these.

### 3. Package the App

Once you have:
1. Updated `manifest.json` with your values
2. Created `color.png` (192x192)
3. Created `outline.png` (32x32)

Create a ZIP file containing these three files:
```bash
zip TeamsBugRaiser.zip manifest.json color.png outline.png
```

### 4. Install in Teams

**Option A: Sideload (for testing)**
1. Open Teams
2. Go to Apps
3. Click "Manage your apps"
4. Click "Upload an app"
5. Select "Upload a custom app"
6. Choose your ZIP file

**Option B: Teams Admin Center (for organization-wide deployment)**
1. Go to Teams Admin Center
2. Navigate to Teams apps > Manage apps
3. Click "Upload new app"
4. Upload your ZIP file
5. Configure permissions and policies

## Icon Design Guidelines

For best results, follow Microsoft's Teams app icon guidelines:
- Use simple, recognizable imagery
- Ensure good contrast
- Test at different sizes
- Avoid text in icons
- Use your brand colors for the color icon
- Make the outline icon monochrome white

## Example Icon Concepts

For a bug tracking app, consider:
- Bug/ladybug icon
- Exclamation mark in a circle
- Checkmark with bug symbol
- Clipboard with bug icon

You can find free icons at:
- https://www.flaticon.com
- https://icons8.com
- https://www.iconfinder.com
