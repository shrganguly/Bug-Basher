# Security Setup Guide

## Encryption Key Setup (Required for Production)

Your Bug Basher bot now encrypts PAT tokens before storing them. This requires an encryption key.

### ⚠️ IMPORTANT
Without setting an encryption key, the bot will use a default key and log warnings. This is NOT secure for production!

---

## Quick Setup (2 minutes)

### Step 1: Generate an Encryption Key

Run this command to generate a secure random key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Output example:**
```
a7f8e3b2c1d0f9e8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4
```

Copy this key!

### Step 2: Add to Render Environment Variables

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Select your Bug Basher service
3. Go to **Environment** tab
4. Add a new environment variable:
   - **Key**: `ENCRYPTION_KEY`
   - **Value**: Paste the generated key
5. Click **Save Changes**

Render will automatically redeploy with the new encryption key.

---

## What Gets Encrypted?

- ✅ **PAT (Personal Access Token)**: Encrypted with AES-256
- ✅ **Stored in files**: Encrypted at rest
- ✅ **Decrypted only when needed**: For ADO API calls

**File storage example:**
```json
{
  "pat": "U2FsdGVkX1+abc123...encrypted_token_here",  // ✅ Encrypted
  "areaPath": "ODSP Product Experiences\\Team",        // Plain text (not sensitive)
  "iterationPath": "ODSP Product Experiences\\Sprint", // Plain text (not sensitive)
  "configuredAt": "2026-01-28T...",
  "expiresAt": "2026-02-02T..."                        // 5 days from setup
}
```

---

## Config Expiration (5 Days)

User configurations now expire after **5 days** for security.

### What Happens:
1. User runs `setup` → Config valid for 5 days
2. After 5 days → Bot shows: "⏰ Your configuration has expired"
3. User runs `setup` again → New 5-day period starts

### Why 5 Days?
- PAT tokens can be revoked or compromised
- Forces periodic re-authentication
- Reduces risk of stale credentials
- Industry best practice for temporary credentials

### Changing Expiration Period

Edit `src/bot/bugRaiserBot.ts` line ~240:
```typescript
// Set expiration to 5 days from now
const expiresAt = new Date();
expiresAt.setDate(expiresAt.getDate() + 5);  // Change 5 to desired days
```

---

## Security Best Practices

### ✅ DO:
- Set `ENCRYPTION_KEY` in Render environment variables
- Use a strong, random key (64 hex characters)
- Keep encryption key secret (never commit to git)
- Regenerate key periodically (forces all users to re-setup)
- Monitor logs for "PAT encrypted" messages
- Keep `storage/` directory in `.gitignore`

### ❌ DON'T:
- Hardcode encryption key in code
- Share encryption key publicly
- Use weak/simple encryption keys
- Commit storage files to git
- Skip encryption for "testing" in production

---

## Verification

After deploying with `ENCRYPTION_KEY` set, check Render logs:

✅ **Correct (Production-Ready):**
```
✅ Using File Storage for state persistence
[No encryption warnings]
User configuration saved (PAT encrypted)
```

❌ **Warning (Not Production-Ready):**
```
⚠️  ENCRYPTION_KEY not set! Using default key. Set ENCRYPTION_KEY env var for production.
```

---

## Troubleshooting

### Users Getting "Failed to decrypt" Error

**Cause**: Encryption key changed after users configured

**Fix**:
1. All users need to run `setup` again
2. This regenerates encrypted tokens with new key
3. Send a Teams announcement: "Please re-run setup command"

### Encryption Key Lost/Forgotten

**Impact**: Cannot decrypt existing PAT tokens

**Fix**:
1. Generate a new encryption key
2. Update `ENCRYPTION_KEY` in Render
3. All users must run `setup` again
4. Old encrypted tokens cannot be recovered (by design - this is secure!)

---

## Security Features Summary

| Feature | Status | Details |
|---------|--------|---------|
| PAT Encryption | ✅ | AES-256, encrypted at rest |
| 5-Day Expiration | ✅ | Automatic expiry, forces re-auth |
| Secure Key Storage | ✅ | Environment variables only |
| 1:1 Chat Restriction | ✅ | Setup only in private chats |
| File Storage Security | ✅ | storage/ in .gitignore |
| Decryption Validation | ✅ | Graceful error handling |
| Expiration Notifications | ✅ | Clear user messages |

---

## Next Steps

1. ✅ Generate encryption key: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
2. ✅ Add `ENCRYPTION_KEY` to Render
3. ✅ Deploy (automatic after saving env var)
4. ✅ Test: Run `setup` in Teams
5. ✅ Verify: Check file in `storage/` has encrypted PAT
6. ✅ Test expiration: Create bug now, test again in 5 days (or modify code to 1 minute for testing)

Your Bug Basher bot is now production-ready and secure! 🔒
