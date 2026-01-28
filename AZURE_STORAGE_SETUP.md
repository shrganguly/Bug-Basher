# Azure Storage Setup for State Persistence

## Why Do You Need This?

By default, the bot uses **MemoryStorage**, which loses all user configurations (PAT tokens, Area Paths, Iteration Paths) every time the server restarts. This happens frequently on platforms like Render.

**With Azure Blob Storage:**
- ✅ User setup persists across restarts
- ✅ Users only need to configure once
- ✅ Production-ready and secure
- ✅ Automatically backed up by Azure

---

## Quick Setup (5 minutes)

### Step 1: Create Azure Storage Account

1. Go to [Azure Portal](https://portal.azure.com)
2. Click "Create a resource" → Search "Storage account" → Create
3. Fill in the details:
   - **Subscription**: Your subscription
   - **Resource group**: Create new or use existing
   - **Storage account name**: `bugbasherstorage` (must be globally unique, lowercase only)
   - **Region**: Choose nearest to your users
   - **Performance**: Standard
   - **Redundancy**: LRS (Locally-redundant storage) is fine for bot state
4. Click "Review + Create" → Create

### Step 2: Get Connection String

1. Once created, go to your storage account
2. Left menu → **Security + networking** → **Access keys**
3. Click "Show keys"
4. Copy **Connection string** under **key1**

It will look like:
```
DefaultEndpointsProtocol=https;AccountName=bugbasherstorage;AccountKey=xxxxx;EndpointSuffix=core.windows.net
```

### Step 3: Add to Render Environment Variables

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Select your Bug Basher service
3. Go to **Environment** tab
4. Add these environment variables:

```
AZURE_STORAGE_CONNECTION_STRING=<paste your connection string here>
AZURE_STORAGE_CONTAINER_NAME=bot-state
```

5. Click **Save Changes**
6. Render will automatically redeploy with persistent storage

---

## Verification

After deployment, check the logs in Render. You should see:

✅ **With Azure Storage (Good):**
```
Using Azure Blob Storage for state persistence
```

❌ **Without Azure Storage (Bad):**
```
⚠️  Using MemoryStorage - State will be lost on restart!
```

---

## How It Works

- User configurations are stored in Azure Blob Storage in a container called `bot-state`
- Each user's data is stored as a separate blob with their user ID
- Data persists indefinitely until explicitly deleted
- Azure handles backup, redundancy, and availability

---

## Cost

Azure Blob Storage pricing is very low for bot state:
- **Storage**: ~$0.018 per GB/month (bot state is typically < 1 MB)
- **Transactions**: First 50,000 reads/writes free per month
- **Expected cost**: < $1/month for typical usage

---

## Security Notes

- Connection string contains sensitive credentials - never commit to git
- Store only in Render environment variables
- Azure encrypts data at rest by default
- User PAT tokens are already stored securely in encrypted state

---

## Alternative: Without Azure Storage (Not Recommended)

If you don't set up Azure Storage:
- ❌ Users will need to run `setup` after every deployment
- ❌ State lost if Render restarts due to inactivity
- ❌ Not suitable for production use
- ✅ OK for testing/development only

---

## Troubleshooting

### "Container not found" error
The container is auto-created on first use. If you see this error, check:
- Connection string is correct
- Storage account exists
- No typos in environment variables

### State still not persisting
- Verify environment variables are set in Render
- Check Render logs for "Using Azure Blob Storage" message
- Redeploy after adding environment variables

### Connection string invalid
- Make sure you copied the entire connection string
- No extra spaces or quotes around the value
- Use "Connection string" not "Key" from Azure Portal
