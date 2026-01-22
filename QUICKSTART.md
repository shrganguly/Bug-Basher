# Quick Start Guide - Teams Bug Raiser

Get your bug raiser bot up and running in 15 minutes!

## Prerequisites

- [x] Bot Framework app registered (App ID + Password)
- [x] Anthropic API key
- [x] Azure DevOps PAT with Work Items permissions
- [x] GitHub account
- [x] Render.com account (free)

---

## 1. Configure Environment (2 min)

Copy `.env.template` to `.env`:

```bash
cp .env.template .env
```

Edit `.env` with your credentials:

```bash
# Required
MICROSOFT_APP_ID=<your-bot-app-id>
MICROSOFT_APP_PASSWORD=<your-bot-password>
ANTHROPIC_API_KEY=<your-anthropic-key>
ADO_ORGANIZATION=<your-org>
ADO_PROJECT=<your-project>
ADO_PAT=<your-pat>
```

---

## 2. Test Locally (3 min)

```bash
# Install dependencies (if not done)
npm install

# Build
npm run build

# Run
npm run dev
```

In another terminal:
```bash
# Expose with ngrok
ngrok http 3000

# Test health
curl http://localhost:3000/health
```

Update Bot Framework messaging endpoint to your ngrok URL:
`https://YOUR-NGROK-URL.ngrok.io/api/messages`

---

## 3. Deploy to Render (5 min)

### Push to GitHub

```bash
# Create repo on GitHub first, then:
git remote add origin https://github.com/YOUR-USERNAME/TeamsBugRaiser.git
git branch -M main
git push -u origin main
```

### Deploy on Render

1. Go to https://dashboard.render.com
2. Click **"New +"** → **"Blueprint"**
3. Connect your GitHub repo
4. Click **"Apply"**

### Configure Environment Variables

In Render dashboard, add these env vars:
- `MICROSOFT_APP_ID`
- `MICROSOFT_APP_PASSWORD`
- `ANTHROPIC_API_KEY`
- `ADO_ORGANIZATION`
- `ADO_PROJECT`
- `ADO_PAT`

Click **"Save Changes"** - Render will auto-deploy!

---

## 4. Update Bot Framework (1 min)

1. Go to Azure Portal → Your Bot Resource
2. Configuration → Messaging endpoint
3. Update to: `https://teams-bug-raiser.onrender.com/api/messages`
4. Click **"Apply"**

---

## 5. Create Teams App (4 min)

### Update Manifest

Edit `appPackage/manifest.json`:

```json
{
  "id": "YOUR-BOT-APP-ID",
  "bots": [{
    "botId": "YOUR-BOT-APP-ID"
  }],
  "validDomains": [
    "teams-bug-raiser.onrender.com"
  ]
}
```

### Create Icons

Create two simple icons or use placeholders:
- `appPackage/color.png` (192x192)
- `appPackage/outline.png` (32x32)

### Package App

```bash
cd appPackage
zip TeamsBugRaiser.zip manifest.json color.png outline.png
```

### Install in Teams

1. Teams → Apps → Manage your apps
2. Upload a custom app
3. Select `TeamsBugRaiser.zip`
4. Add to a team or chat

---

## 6. Test It! (1 min)

In Teams:

1. Send a message: "Login button is broken on mobile"
2. Reply with: `@bug raiser raise a bug`
3. Bot creates bug in ADO and responds with link!

---

## Troubleshooting

### Bot doesn't respond
- Check Render logs for errors
- Verify messaging endpoint in Azure Bot Service
- Ensure bot is added to the conversation

### AI analysis fails
- Verify `ANTHROPIC_API_KEY` is correct
- Check Render env vars are saved
- Test: `curl https://YOUR-SERVICE.onrender.com/api/test-ai`

### Bug creation fails
- Verify ADO PAT has correct permissions
- Check org and project names are exact
- Test: `curl https://YOUR-SERVICE.onrender.com/api/test-ado`

---

## Easy Deployment Script

Use the PowerShell script for quick deployments:

```powershell
.\deploy.ps1
```

This will:
- Build the project
- Commit changes
- Push to GitHub
- Trigger Render deployment

---

## Next Steps

- Read `RENDER_DEPLOYMENT.md` for detailed deployment info
- Check `README.md` for full documentation
- Customize the AI prompts in `src/services/aiService.ts`
- Add Adaptive Cards for better UX
- Set up monitoring and alerts

---

## Quick Commands

```bash
# Development
npm run dev          # Run with hot reload
npm run build        # Compile TypeScript
npm start            # Run production build

# Deployment
.\deploy.ps1         # Deploy to Render via GitHub
git push             # Auto-deploy (if Render connected)

# Testing
curl http://localhost:3000/health         # Local health check
curl https://YOUR-SERVICE.onrender.com/health  # Production health check
```

---

## Support

- **Render Issues**: https://render.com/docs
- **Bot Framework**: https://docs.microsoft.com/azure/bot-service/
- **Claude API**: https://docs.anthropic.com

Happy bug tracking! 🐛✨
