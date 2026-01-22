# Deploying Teams Bug Raiser to Render.com

This guide walks you through deploying the Teams Bug Raiser bot to Render.com.

## Prerequisites

1. GitHub account
2. Render.com account (free tier works)
3. All credentials ready:
   - Bot Framework App ID and Password
   - Anthropic API key
   - Azure DevOps PAT

---

## Step 1: Push to GitHub

If you haven't already, create a GitHub repository and push your code:

```bash
cd C:/Users/shrganguly/AgentsToolkitProjects/TeamsBugRaiser

# Create a new repository on GitHub first, then:
git remote add origin https://github.com/YOUR-USERNAME/TeamsBugRaiser.git
git branch -M main
git push -u origin main
```

---

## Step 2: Create Render Service

### Option A: Using render.yaml (Recommended)

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click **"New +"** → **"Blueprint"**
3. Connect your GitHub repository
4. Render will detect `render.yaml` automatically
5. Click **"Apply"**

### Option B: Manual Setup

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository
4. Configure:
   - **Name**: `teams-bug-raiser`
   - **Region**: Oregon (US West)
   - **Branch**: `main`
   - **Runtime**: Node
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Plan**: Free

---

## Step 3: Configure Environment Variables

In your Render service dashboard, go to **Environment** tab and add:

### Bot Framework
```
MICROSOFT_APP_ID=<your-bot-app-id>
MICROSOFT_APP_PASSWORD=<your-bot-password>
MICROSOFT_APP_TYPE=MultiTenant
```

### AI Configuration
```
AI_PROVIDER=claude
ANTHROPIC_API_KEY=<your-anthropic-api-key>
CLAUDE_MODEL=claude-sonnet-4-20250514
```

### Azure DevOps
```
ADO_ORGANIZATION=<your-ado-org>
ADO_PROJECT=<your-ado-project>
ADO_PAT=<your-personal-access-token>
```

### Optional ADO Settings
```
ADO_AREA_PATH=YourProject\YourArea
ADO_ITERATION_PATH=YourProject\Sprint1
```

### Server Configuration
```
PORT=10000
NODE_ENV=production
BASE_URL=https://teams-bug-raiser.onrender.com
```

**Note**: Replace `teams-bug-raiser` in BASE_URL with your actual Render service name if different.

---

## Step 4: Deploy

1. Click **"Manual Deploy"** → **"Deploy latest commit"**
2. Wait for the build to complete (2-3 minutes)
3. Check the logs for any errors
4. Your service will be available at: `https://teams-bug-raiser.onrender.com`

---

## Step 5: Update Bot Framework

1. Go to [Azure Bot Service](https://portal.azure.com)
2. Navigate to your bot resource
3. Go to **Configuration** → **Messaging endpoint**
4. Update to: `https://teams-bug-raiser.onrender.com/api/messages`
5. Click **"Apply"**

---

## Step 6: Update Teams Manifest

1. Edit `appPackage/manifest.json`
2. Update the `validDomains` array:
   ```json
   "validDomains": [
     "teams-bug-raiser.onrender.com"
   ]
   ```
3. Update developer URLs if needed:
   ```json
   "developer": {
     "websiteUrl": "https://teams-bug-raiser.onrender.com",
     "privacyUrl": "https://teams-bug-raiser.onrender.com/privacy",
     "termsOfUseUrl": "https://teams-bug-raiser.onrender.com/terms"
   }
   ```

---

## Step 7: Test Deployment

### Test Health Endpoint
```bash
curl https://teams-bug-raiser.onrender.com/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2026-01-22T...",
  "config": {
    "botConfigured": true,
    "aiConfigured": true,
    "adoConfigured": true
  }
}
```

### Test ADO Connection
```bash
curl https://teams-bug-raiser.onrender.com/api/test-ado
```

### Test AI Service
```bash
curl https://teams-bug-raiser.onrender.com/api/test-ai
```

---

## Step 8: Reinstall Teams App

1. Package the updated manifest:
   ```bash
   cd appPackage
   zip TeamsBugRaiser.zip manifest.json color.png outline.png
   ```

2. In Teams:
   - Go to Apps → Manage your apps
   - Remove old version (if exists)
   - Upload the new package

---

## Automatic Deployments

Render automatically deploys when you push to GitHub:

```bash
# Make changes
git add .
git commit -m "Update feature"
git push origin main

# Render will auto-deploy
```

---

## Monitoring & Logs

### View Logs
1. Go to Render Dashboard
2. Select your service
3. Click **"Logs"** tab
4. View real-time logs

### Check Service Status
- Dashboard shows service status (Live/Building/Failed)
- Health checks run automatically at `/health`

---

## Troubleshooting

### Build Fails

**Problem**: TypeScript compilation errors

**Solution**:
```bash
# Test build locally first
npm run build

# Fix any errors, then push
git add .
git commit -m "Fix build errors"
git push
```

### Service Starts but Crashes

**Problem**: Missing environment variables

**Solution**:
1. Check logs for error messages
2. Verify all required env vars are set
3. Check for typos in variable names

### Bot Doesn't Respond in Teams

**Problem**: Messaging endpoint not updated

**Solution**:
1. Verify endpoint in Azure Bot Service
2. Should be: `https://YOUR-SERVICE.onrender.com/api/messages`
3. Test with: `curl -X POST https://YOUR-SERVICE.onrender.com/api/messages`

### AI Service Fails

**Problem**: Invalid API key or quota exceeded

**Solution**:
1. Check Anthropic API key is correct
2. Verify API quota/billing status
3. Check logs: `GET /api/test-ai`

### ADO Bug Creation Fails

**Problem**: Invalid PAT or permissions

**Solution**:
1. Verify PAT has "Work Items: Read, Write" permissions
2. Check organization and project names are correct
3. Test: `GET /api/test-ado`

---

## Free Tier Limitations

Render's free tier:
- ✅ 750 hours/month (enough for 24/7)
- ✅ Automatic HTTPS
- ✅ Auto-deploy from GitHub
- ⚠️ Spins down after 15 min inactivity (may take 30s to wake)
- ⚠️ 512 MB RAM

**Note**: First request after inactivity may be slow as service wakes up.

---

## Upgrading to Paid Plan

For production use, consider Render's Starter plan ($7/month):
- Always-on (no spin down)
- More RAM and CPU
- Better performance
- Priority support

---

## Cost Considerations

**Free Tier Services**:
- Render.com: Free (with limitations)
- Azure Bot Service: Free (10,000 messages/month)

**Paid Services**:
- Anthropic Claude API: Pay per token (~$3-15 per 1M tokens)
- Azure DevOps: Free for up to 5 users

**Estimated monthly cost for moderate use**: $5-20

---

## Deployment Checklist

- [ ] Code pushed to GitHub
- [ ] Render service created
- [ ] All environment variables configured
- [ ] Service deployed successfully
- [ ] Health check passes
- [ ] Bot Framework messaging endpoint updated
- [ ] Teams manifest updated with Render domain
- [ ] Teams app reinstalled/updated
- [ ] Tested creating a bug end-to-end

---

## Support

For issues:
- **Render**: [Render Docs](https://render.com/docs)
- **Bot Framework**: [Azure Bot Service Docs](https://docs.microsoft.com/azure/bot-service/)
- **Anthropic**: [Claude API Docs](https://docs.anthropic.com)

---

## Next Steps

After successful deployment:
1. Share the bot with your team
2. Monitor logs for any errors
3. Gather feedback and iterate
4. Consider adding features like:
   - Adaptive Cards for bug confirmation
   - Multiple ADO project support
   - Bug status tracking
   - Analytics dashboard
