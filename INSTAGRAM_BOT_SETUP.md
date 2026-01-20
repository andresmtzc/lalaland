# Instagram Collab Bot Setup Guide

## Overview

This bot monitors Instagram collaboration post comments for specific keywords (PIETRA, AQUA, CAÑADAS) and automatically sends registration links via DM.

## Architecture

```
Instagram Comment ("PIETRA") → Webhook → Supabase Edge Function → collab_requests table
                                                                           ↓
Instagram Bot (Oracle Server) ← Polls every 3 seconds ← Supabase Database
        ↓
Sends DM with registration link via Graph API
```

## Prerequisites

1. **Instagram Business Account** connected to a Facebook Page
2. **Facebook Developer App** with Instagram Graph API access
3. **Supabase Project** (already configured)
4. **Oracle Server** (same one running WhatsApp bot)

---

## Step 1: Facebook App & Instagram Setup

### 1.1 Create/Configure Facebook App

1. Go to https://developers.facebook.com/apps
2. Create a new app or use existing one
3. Select "Business" type
4. Add **Instagram** product to your app

### 1.2 Get Instagram Business Account ID

1. In your Facebook App dashboard, go to **Instagram > Basic Display**
2. Click "Add Instagram Account"
3. Connect your Instagram Business Account
4. Note your **Instagram Account ID** (IGSID) - this is your `INSTAGRAM_PAGE_ID`

### 1.3 Generate Access Token

**Option A: Using Graph API Explorer (Quick Test)**

1. Go to https://developers.facebook.com/tools/explorer
2. Select your app from dropdown
3. Under "User or Page", select your Instagram Business Account
4. Add permissions:
   - `instagram_basic`
   - `instagram_manage_comments`
   - `instagram_manage_messages`
   - `pages_manage_metadata`
   - `pages_read_engagement`
5. Click "Generate Access Token"
6. **Important**: This is a short-lived token (1-2 hours)

**Option B: Get Long-Lived Token (Production)**

After getting short-lived token from Graph API Explorer:

```bash
# Exchange short-lived token for long-lived (60 days)
curl -X GET "https://graph.facebook.com/v21.0/oauth/access_token" \
  -d "grant_type=fb_exchange_token" \
  -d "client_id=YOUR_APP_ID" \
  -d "client_secret=YOUR_APP_SECRET" \
  -d "fb_exchange_token=YOUR_SHORT_LIVED_TOKEN"
```

Response:
```json
{
  "access_token": "EAAxxxxxxxxxxxx",
  "token_type": "bearer",
  "expires_in": 5184000
}
```

**Option C: Never-Expiring Token (Best for Bots)**

1. Get a Page Access Token from Graph API Explorer
2. Use Page token to get Instagram Business Account token:

```bash
curl -X GET "https://graph.facebook.com/v21.0/YOUR_INSTAGRAM_ACCOUNT_ID?fields=id,username&access_token=YOUR_PAGE_ACCESS_TOKEN"
```

### 1.4 Verify Your Tokens

Test your Instagram access:

```bash
# Check your Instagram account info
curl "https://graph.facebook.com/v21.0/YOUR_INSTAGRAM_PAGE_ID?fields=id,username,followers_count&access_token=YOUR_ACCESS_TOKEN"

# Expected response:
# {
#   "id": "17841XXXXXXXXXX",
#   "username": "your_username",
#   "followers_count": 1234
# }
```

### 1.5 Get App Secret

1. In your Facebook App dashboard, go to **Settings > Basic**
2. Find **App Secret** (click "Show" to reveal)
3. Save this as `INSTAGRAM_APP_SECRET`

---

## Step 2: Configure Instagram Webhooks

### 2.1 Set Supabase Secrets

```bash
# From your local machine (with Supabase CLI installed)
cd /path/to/lalaland

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref jmoxbhodpvnlmtihcwvt

# Set Instagram secrets for webhook function
supabase secrets set INSTAGRAM_VERIFY_TOKEN="your_random_secret_string_here"
supabase secrets set INSTAGRAM_APP_SECRET="your_facebook_app_secret_here"
```

**Generate a random verify token:**
```bash
# Linux/Mac
openssl rand -hex 32

# Or just use any random string like: "my_super_secret_verify_token_2025"
```

### 2.2 Deploy Database Migration

```bash
# Apply the collab_requests table migration
supabase db push
```

Verify it worked:
```bash
# Check if table exists
supabase db diff
```

### 2.3 Deploy Webhook Edge Function

```bash
# Deploy the Instagram webhook handler
supabase functions deploy instagram-webhook

# Expected output:
# Deploying instagram-webhook (project ref: jmoxbhodpvnlmtihcwvt)
# ✓ Deployed instagram-webhook
```

Get the function URL:
```
https://jmoxbhodpvnlmtihcwvt.supabase.co/functions/v1/instagram-webhook
```

### 2.4 Configure Facebook Webhooks

1. Go to your Facebook App dashboard
2. Navigate to **Instagram > Configuration**
3. Click **Add Callback URL**
4. Enter:
   - **Callback URL**: `https://jmoxbhodpvnlmtihcwvt.supabase.co/functions/v1/instagram-webhook`
   - **Verify Token**: (the same token you set in `INSTAGRAM_VERIFY_TOKEN`)
5. Click **Verify and Save**

### 2.5 Subscribe to Webhook Events

1. In **Instagram > Configuration**, find **Webhook Subscriptions**
2. Subscribe to these fields:
   - ✅ `comments` (required - for comment notifications)
   - ✅ `mentions` (optional - for @mentions in stories)
3. Click **Save**

### 2.6 Test Webhook

Test that Instagram can reach your webhook:

```bash
# Check Supabase function logs
supabase functions logs instagram-webhook --tail

# In another terminal, post a test comment on your Instagram
# You should see webhook data in the logs
```

---

## Step 3: Deploy Instagram Bot to Oracle Server

### 3.1 Install Dependencies

SSH into your Oracle server:

```bash
ssh user@your-oracle-server

# Navigate to bot directory
cd /path/to/lalaland

# Install required npm packages
npm install @supabase/supabase-js axios

# Or if using yarn
yarn add @supabase/supabase-js axios
```

### 3.2 Create Environment File

```bash
# Create .env.instagram file
nano .env.instagram
```

Add your credentials:
```env
SUPABASE_URL=https://jmoxbhodpvnlmtihcwvt.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxxxx  # Your service role key
INSTAGRAM_ACCESS_TOKEN=EAAxxxxxxxxxxxx  # Your long-lived token
INSTAGRAM_PAGE_ID=17841XXXXXXXXXX  # Your Instagram Business Account ID
```

**To get your Supabase Service Role Key:**
1. Go to https://supabase.com/dashboard/project/jmoxbhodpvnlmtihcwvt/settings/api
2. Copy the `service_role` key (not the anon key!)

### 3.3 Test the Bot Manually

```bash
# Load environment variables and run bot
export $(cat .env.instagram | xargs) && node instagram-bot.js
```

Expected output:
```
🤖 Instagram Collab Bot starting...
📊 Polling interval: 3000ms
🔐 Instagram Page ID: 17841XXXXXXXXXX
🔄 Starting collab request polling...
✅ Instagram Collab Bot is running
   Press Ctrl+C to stop
```

### 3.4 Deploy with PM2 (Production)

```bash
# Install PM2 globally (if not already installed)
npm install -g pm2

# Start Instagram bot with PM2
pm2 start instagram-bot.js --name instagram-bot --env-file .env.instagram

# Start WhatsApp bot (if not already running)
pm2 start bot.js --name whatsapp-bot

# View running processes
pm2 list

# Expected:
# ┌─────┬──────────────────┬─────────┬─────────┬──────────┐
# │ id  │ name             │ status  │ restart │ uptime   │
# ├─────┼──────────────────┼─────────┼─────────┼──────────┤
# │ 0   │ whatsapp-bot     │ online  │ 0       │ 5h       │
# │ 1   │ instagram-bot    │ online  │ 0       │ 0s       │
# └─────┴──────────────────┴─────────┴─────────┴──────────┘

# Save PM2 configuration
pm2 save

# Setup PM2 to start on server reboot
pm2 startup
# Follow the command it gives you (usually: sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u youruser --hp /home/youruser)
```

### 3.5 Monitor Logs

```bash
# View Instagram bot logs
pm2 logs instagram-bot

# View both bots
pm2 logs

# View last 100 lines
pm2 logs instagram-bot --lines 100
```

---

## Step 4: Testing the Complete Flow

### 4.1 End-to-End Test

1. **Post a collaboration on Instagram** (or use existing post)
2. **Comment with keyword**: Type "PIETRA" in the comments
3. **Check webhook logs**:
   ```bash
   supabase functions logs instagram-webhook --tail
   ```
   You should see: `✅ Keyword "PIETRA" detected → Client: agora`

4. **Check database**:
   ```bash
   # Query Supabase to see the request
   supabase db query "SELECT * FROM collab_requests ORDER BY created_at DESC LIMIT 5;"
   ```

5. **Check bot logs**:
   ```bash
   pm2 logs instagram-bot
   ```
   You should see: `✅ DM sent to [user_id]`

6. **Verify DM received**: Check your Instagram DMs for the registration link

### 4.2 Test DM Sending Manually

```bash
# Test sending a DM via Graph API directly
curl -X POST "https://graph.facebook.com/v21.0/YOUR_INSTAGRAM_PAGE_ID/messages" \
  -d "access_token=YOUR_ACCESS_TOKEN" \
  -d "recipient={\"id\":\"RECIPIENT_INSTAGRAM_USER_ID\"}" \
  -d "message={\"text\":\"Test message from bot\"}"
```

---

## Step 5: Adding New Keywords/Clients

### 5.1 Edit Webhook Function

Edit `/supabase/functions/instagram-webhook/index.ts`:

```typescript
const KEYWORD_TO_CLIENT: Record<string, string> = {
  'PIETRA': 'agora',
  'AQUA': 'agora',
  'CAÑADAS': 'agora',
  'INVERTA': 'inverta',  // Add new keyword
  'CPI': 'cpi',          // Add new keyword
}
```

### 5.2 Redeploy Function

```bash
supabase functions deploy instagram-webhook
```

---

## Troubleshooting

### Issue: "Invalid signature" error in webhook

**Solution**: Verify your `INSTAGRAM_APP_SECRET` is correct:
```bash
supabase secrets list
supabase secrets set INSTAGRAM_APP_SECRET="correct_secret_here"
supabase functions deploy instagram-webhook
```

### Issue: Bot can't send DMs

**Possible causes**:
1. **User hasn't messaged you first**: Instagram requires users to send the first message OR comment on your post
2. **Invalid access token**: Check token hasn't expired
3. **Missing permissions**: Verify `instagram_manage_messages` permission

**Test your token**:
```bash
curl "https://graph.facebook.com/v21.0/me?access_token=YOUR_TOKEN"
```

### Issue: Webhook not receiving comments

**Check**:
1. Webhook is verified (green checkmark in Facebook App dashboard)
2. Subscribed to `comments` field
3. Instagram account is a **Business/Creator** account (not personal)
4. Comments are on **your own posts** (collaborator posts might not trigger webhooks)

**View webhook delivery attempts**:
1. Go to Facebook App dashboard
2. **Instagram > Configuration > Webhooks**
3. Click "Test" to send a test payload

### Issue: Database connection fails

**Solution**: Verify service role key:
```bash
# Test Supabase connection
curl "https://jmoxbhodpvnlmtihcwvt.supabase.co/rest/v1/collab_requests?select=*&limit=1" \
  -H "apikey: YOUR_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```

---

## Monitoring & Analytics

### View Request Stats

```sql
-- Count requests by keyword
SELECT keyword, COUNT(*) as total
FROM collab_requests
GROUP BY keyword
ORDER BY total DESC;

-- Count by status
SELECT status, COUNT(*) as total
FROM collab_requests
GROUP BY status;

-- Requests by post
SELECT post_id, COUNT(*) as comments
FROM collab_requests
GROUP BY post_id
ORDER BY comments DESC;

-- Recent requests
SELECT
  instagram_username,
  keyword,
  status,
  created_at,
  completed_at
FROM collab_requests
ORDER BY created_at DESC
LIMIT 20;
```

### PM2 Monitoring Dashboard

```bash
# Install PM2 web interface
pm2 install pm2-logrotate  # Prevent logs from filling disk
pm2 set pm2-logrotate:max_size 10M

# View real-time dashboard
pm2 monit
```

---

## Security Best Practices

1. **Never commit tokens to git**:
   ```bash
   # Add to .gitignore
   echo ".env.instagram" >> .gitignore
   ```

2. **Rotate access tokens every 60 days**: Set a calendar reminder

3. **Monitor rate limits**: Instagram limits DMs to ~200/day per account

4. **Validate webhook signatures**: Already implemented in the edge function

5. **Use HTTPS only**: Webhooks must use HTTPS (Supabase provides this)

---

## Cost Estimates

- **Supabase**: Free tier (up to 50,000 requests/month on edge functions)
- **Instagram API**: Free (no cost for Graph API usage)
- **Oracle Server**: (you already have this running)

**Expected usage**:
- ~100 comments/day = ~3,000 webhook calls/month
- ~3,000 database inserts/month
- ~3,000 bot polls x 30 days = minimal database reads

**Estimate**: Well within Supabase free tier limits

---

## Next Steps

1. ✅ Set up Facebook App and get tokens
2. ✅ Deploy Supabase migration and edge function
3. ✅ Configure webhooks in Facebook dashboard
4. ✅ Deploy bot to Oracle server with PM2
5. ✅ Test end-to-end flow
6. 📊 Monitor for 24 hours to verify stability
7. 🎯 Add more keywords/clients as needed

---

## Support & Debugging

**View all logs**:
```bash
# Supabase webhook logs
supabase functions logs instagram-webhook

# Bot logs
pm2 logs instagram-bot

# Database queries
supabase db query "SELECT * FROM collab_requests WHERE status='error';"
```

**Restart bot**:
```bash
pm2 restart instagram-bot
```

**Stop bot**:
```bash
pm2 stop instagram-bot
pm2 delete instagram-bot  # Remove from PM2
```
