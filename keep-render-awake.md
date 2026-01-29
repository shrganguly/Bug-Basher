# Keep Render Server Awake (Free Tier)

Render free tier sleeps after 15 minutes of inactivity. Here are ways to keep it awake:

## Option 1: GitHub Actions Cron Job (Recommended)

Create `.github/workflows/keep-awake.yml`:

```yaml
name: Keep Render Awake

on:
  schedule:
    # Ping every 10 minutes (*/10 means every 10 minutes)
    - cron: '*/10 * * * *'
  workflow_dispatch: # Allows manual trigger

jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - name: Ping Render Service
        run: |
          echo "Pinging Bug Basher server..."
          response=$(curl -s -o /dev/null -w "%{http_code}" https://bug-basher.onrender.com/health)
          echo "Response code: $response"
          if [ $response -eq 200 ]; then
            echo "✅ Server is awake and healthy"
          else
            echo "⚠️ Server returned: $response"
          fi
```

**Pros:**
- ✅ Completely free
- ✅ Runs automatically via GitHub
- ✅ No additional setup needed

**Cons:**
- ⚠️ Still has 15-30 second cold start when bot is first mentioned after sleep
- ⚠️ GitHub Actions has usage limits on free tier

## Option 2: UptimeRobot (External Service)

1. Go to https://uptimerobot.com (free tier)
2. Create account
3. Add new monitor:
   - Monitor Type: HTTP(s)
   - URL: `https://bug-basher.onrender.com/health`
   - Monitoring Interval: 5 minutes (free tier)
4. Save

**Pros:**
- ✅ Free and reliable
- ✅ Also provides uptime monitoring
- ✅ Email alerts if server is down

**Cons:**
- ⚠️ Still has cold start issues
- ⚠️ Requires external service

## Option 3: Cron-job.org

1. Go to https://cron-job.org
2. Create free account
3. Create new cron job:
   - Title: "Keep Bug Basher Awake"
   - URL: `https://bug-basher.onrender.com/health`
   - Schedule: Every 10 minutes
4. Save

**Similar pros/cons to UptimeRobot**

## Option 4: Add Health Check Endpoint (Already exists)

Your bot already has a `/health` endpoint. Make sure it responds quickly:

```typescript
// This is already in your server.ts
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
});
```

## Limitations of Free Tier Workarounds

⚠️ **Important:** Even with keep-awake pings, Render free tier has:
- 750 hours/month limit (not enough for 24/7)
- Cold start delays (15-30 seconds)
- Shared resources (can be slow)

**For production use, upgrade to Render's paid tier ($7/month) or use Azure App Service.**

## Render Paid Tier ($7/month)

If you like Render, upgrade to paid:
```bash
# No code changes needed, just upgrade in Render dashboard
# Benefits:
# - No sleep
# - No cold starts
# - 0.5 GB RAM minimum
# - Priority support
```

## Recommendation

**For a Microsoft/Teams bot:**
→ Use **Azure App Service B1 tier ($13/month)** - best integration with your existing Azure DevOps and Teams infrastructure

**If you must stay free:**
→ Use GitHub Actions keep-awake + accept the cold start delays
