# Deploy Bug Basher to Azure App Service

## Prerequisites
- Azure subscription
- Azure CLI installed: https://aka.ms/installazurecli

## Quick Deployment Steps

### 1. Login to Azure
```bash
az login
```

### 2. Create Resource Group (if you don't have one)
```bash
az group create --name bug-basher-rg --location eastus
```

### 3. Create App Service Plan (Basic tier - no sleep)
```bash
az appservice plan create \
  --name bug-basher-plan \
  --resource-group bug-basher-rg \
  --sku B1 \
  --is-linux
```

**Pricing Note:** B1 (Basic) tier costs ~$13/month and NEVER sleeps

### 4. Create Web App
```bash
az webapp create \
  --name bug-basher-bot \
  --resource-group bug-basher-rg \
  --plan bug-basher-plan \
  --runtime "NODE:20-lts"
```

### 5. Configure Environment Variables
```bash
# Set all your environment variables
az webapp config appsettings set \
  --name bug-basher-bot \
  --resource-group bug-basher-rg \
  --settings \
    BOT_ID="your-bot-id" \
    BOT_PASSWORD="your-bot-password" \
    BOT_TYPE="MultiTenant" \
    AI_PROVIDER="azure-openai" \
    AZURE_OPENAI_ENDPOINT="your-endpoint" \
    AZURE_OPENAI_API_KEY="your-key" \
    AZURE_OPENAI_DEPLOYMENT_NAME="your-deployment" \
    ADO_ORGANIZATION="your-org" \
    ADO_PROJECT="your-project" \
    ADO_PAT="your-pat"
```

### 6. Deploy from GitHub (Automated CI/CD)

**Option A: Using Azure Portal**
1. Go to Azure Portal → Your Web App
2. Deployment Center → GitHub
3. Authorize and select your repository
4. Select branch: `main`
5. Azure will auto-deploy on every push

**Option B: Using GitHub Actions (Recommended)**

Create `.github/workflows/azure-deploy.yml`:

```yaml
name: Deploy to Azure App Service

on:
  push:
    branches: [ main ]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v4

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20'

    - name: Install dependencies
      run: npm ci

    - name: Build
      run: npm run build

    - name: Deploy to Azure
      uses: azure/webapps-deploy@v2
      with:
        app-name: 'bug-basher-bot'
        publish-profile: ${{ secrets.AZURE_WEBAPP_PUBLISH_PROFILE }}
        package: .
```

To get the publish profile:
```bash
az webapp deployment list-publishing-profiles \
  --name bug-basher-bot \
  --resource-group bug-basher-rg \
  --xml
```

Add this as `AZURE_WEBAPP_PUBLISH_PROFILE` secret in GitHub Settings → Secrets.

### 7. Update Teams Bot Endpoint

Update your bot's messaging endpoint in Azure Bot Service to:
```
https://bug-basher-bot.azurewebsites.net/api/messages
```

### 8. Verify Deployment

```bash
# Check if app is running
curl https://bug-basher-bot.azurewebsites.net/health

# View logs
az webapp log tail \
  --name bug-basher-bot \
  --resource-group bug-basher-rg
```

## Cost Optimization

### Free Tier (F1) - Has limitations but doesn't sleep
```bash
az appservice plan create \
  --name bug-basher-plan-free \
  --resource-group bug-basher-rg \
  --sku F1 \
  --is-linux
```
**Note:** Free tier has:
- 60 CPU minutes/day limit
- 1 GB RAM
- 1 GB storage
- Still better than Render's sleep behavior

### Basic Tier (B1) - Recommended for production
- No CPU time limits
- No sleep/cold start issues
- Always-on capability
- Cost: ~$13/month

## Monitoring

Enable Application Insights:
```bash
az monitor app-insights component create \
  --app bug-basher-insights \
  --location eastus \
  --resource-group bug-basher-rg \
  --application-type web

# Link to Web App
az webapp config appsettings set \
  --name bug-basher-bot \
  --resource-group bug-basher-rg \
  --settings APPLICATIONINSIGHTS_CONNECTION_STRING="<connection-string>"
```

## Useful Commands

```bash
# Restart app
az webapp restart --name bug-basher-bot --resource-group bug-basher-rg

# View logs
az webapp log tail --name bug-basher-bot --resource-group bug-basher-rg

# SSH into container (for debugging)
az webapp ssh --name bug-basher-bot --resource-group bug-basher-rg

# Scale up/down
az appservice plan update --name bug-basher-plan --resource-group bug-basher-rg --sku B2
```

## Troubleshooting

### App not starting?
Check logs:
```bash
az webapp log download --name bug-basher-bot --resource-group bug-basher-rg
```

### Environment variables not working?
Verify they're set:
```bash
az webapp config appsettings list --name bug-basher-bot --resource-group bug-basher-rg
```

### Need to see real-time logs?
```bash
az webapp log tail --name bug-basher-bot --resource-group bug-basher-rg
```
