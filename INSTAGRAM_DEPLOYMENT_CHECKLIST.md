# Instagram Collab Bot - Deployment Checklist

Use this checklist to deploy the Instagram bot step-by-step.

## Phase 1: Get Instagram Credentials

- [ ] Verify Instagram Business Account is connected to Facebook Page
- [ ] Create/access Facebook Developer App
- [ ] Add Instagram product to app
- [ ] Get Instagram Business Account ID (INSTAGRAM_PAGE_ID)
- [ ] Generate long-lived access token (INSTAGRAM_ACCESS_TOKEN)
- [ ] Get Facebook App Secret (INSTAGRAM_APP_SECRET)
- [ ] Generate random verify token (INSTAGRAM_VERIFY_TOKEN)

### Test Credentials

```bash
# Test Instagram access token works
curl "https://graph.facebook.com/v21.0/YOUR_INSTAGRAM_PAGE_ID?fields=id,username&access_token=YOUR_ACCESS_TOKEN"
```

**Expected**: JSON response with your Instagram username

---

## Phase 2: Deploy to Supabase

### Set Secrets

```bash
cd /home/user/lalaland
supabase login
supabase link --project-ref jmoxbhodpvnlmtihcwvt
```

- [ ] Set Instagram verify token:
  ```bash
  supabase secrets set INSTAGRAM_VERIFY_TOKEN="your_random_string"
  ```

- [ ] Set Instagram app secret:
  ```bash
  supabase secrets set INSTAGRAM_APP_SECRET="your_facebook_app_secret"
  ```

### Deploy Database

- [ ] Apply migration:
  ```bash
  supabase db push
  ```

- [ ] Verify table created:
  ```bash
  supabase db query "SELECT * FROM collab_requests LIMIT 1;"
  ```

### Deploy Edge Function

- [ ] Deploy webhook handler:
  ```bash
  supabase functions deploy instagram-webhook
  ```

- [ ] Get webhook URL:
  ```
  https://jmoxbhodpvnlmtihcwvt.supabase.co/functions/v1/instagram-webhook
  ```

- [ ] Test webhook responds:
  ```bash
  curl "https://jmoxbhodpvnlmtihcwvt.supabase.co/functions/v1/instagram-webhook"
  ```

---

## Phase 3: Configure Facebook Webhooks

- [ ] Go to Facebook App Dashboard → Instagram → Configuration
- [ ] Click "Add Callback URL"
- [ ] Enter webhook URL: `https://jmoxbhodpvnlmtihcwvt.supabase.co/functions/v1/instagram-webhook`
- [ ] Enter verify token (same as INSTAGRAM_VERIFY_TOKEN)
- [ ] Click "Verify and Save" (should show green checkmark)
- [ ] Subscribe to webhook field: `comments`
- [ ] Click "Save"

### Test Webhook

- [ ] View webhook logs:
  ```bash
  supabase functions logs instagram-webhook --tail
  ```

- [ ] Post a test comment on Instagram with "PIETRA"
- [ ] Verify webhook received data in logs

---

## Phase 4: Deploy Bot to Oracle Server

### Prepare Server

- [ ] SSH into Oracle server:
  ```bash
  ssh user@your-oracle-server
  ```

- [ ] Navigate to project:
  ```bash
  cd /path/to/lalaland
  ```

- [ ] Install dependencies:
  ```bash
  npm install @supabase/supabase-js axios
  ```

### Configure Environment

- [ ] Create `.env.instagram` file:
  ```bash
  nano .env.instagram
  ```

- [ ] Add credentials:
  ```env
  SUPABASE_URL=https://jmoxbhodpvnlmtihcwvt.supabase.co
  SUPABASE_SERVICE_KEY=your_service_role_key
  INSTAGRAM_ACCESS_TOKEN=your_long_lived_token
  INSTAGRAM_PAGE_ID=your_instagram_business_id
  ```

- [ ] Save and exit (Ctrl+X, Y, Enter)

### Test Bot Manually

- [ ] Run bot:
  ```bash
  export $(cat .env.instagram | xargs) && node instagram-bot.js
  ```

- [ ] Verify output:
  ```
  🤖 Instagram Collab Bot starting...
  📊 Polling interval: 3000ms
  🔐 Instagram Page ID: 17841XXXXXXXXXX
  ✅ Instagram Collab Bot is running
  ```

- [ ] Press Ctrl+C to stop

### Deploy with PM2

- [ ] Start bot with PM2:
  ```bash
  pm2 start instagram-bot.js --name instagram-bot --env-file .env.instagram
  ```

- [ ] Verify running:
  ```bash
  pm2 list
  ```

- [ ] Save PM2 config:
  ```bash
  pm2 save
  ```

- [ ] Setup auto-restart on reboot:
  ```bash
  pm2 startup
  # Follow the command it outputs
  ```

---

## Phase 5: End-to-End Testing

- [ ] Comment "PIETRA" on an Instagram collaboration post
- [ ] Check webhook received comment:
  ```bash
  supabase functions logs instagram-webhook
  ```
  Expected: `✅ Keyword "PIETRA" detected`

- [ ] Check database has record:
  ```bash
  supabase db query "SELECT * FROM collab_requests ORDER BY created_at DESC LIMIT 1;"
  ```

- [ ] Check bot processed request:
  ```bash
  pm2 logs instagram-bot --lines 20
  ```
  Expected: `✅ DM sent to [user_id]`

- [ ] Verify DM received in Instagram

- [ ] Click registration link in DM
- [ ] Fill out form
- [ ] Check WhatsApp bot sent map link

---

## Phase 6: Monitoring Setup

- [ ] Check bot is running:
  ```bash
  pm2 list
  ```

- [ ] View real-time logs:
  ```bash
  pm2 logs instagram-bot
  ```

- [ ] Query request stats:
  ```bash
  supabase db query "SELECT keyword, status, COUNT(*) FROM collab_requests GROUP BY keyword, status;"
  ```

- [ ] Setup log rotation:
  ```bash
  pm2 install pm2-logrotate
  pm2 set pm2-logrotate:max_size 10M
  ```

---

## Troubleshooting

### Webhook not receiving comments

1. Verify webhook is verified (green checkmark in Facebook dashboard)
2. Check subscribed to `comments` field
3. Ensure Instagram is Business/Creator account
4. Test with comment on YOUR OWN post (not collaborator yet)

### Bot can't send DMs

1. Verify user commented on your post (establishes 24hr messaging window)
2. Check access token hasn't expired
3. Verify `instagram_manage_messages` permission

### Database errors

1. Check service role key is correct
2. Verify table exists: `supabase db query "\\dt collab_requests"`
3. Check RLS policies allow service role access

---

## Post-Deployment

- [ ] Monitor for 24 hours to ensure stability
- [ ] Document any issues encountered
- [ ] Update keywords/clients as needed
- [ ] Set calendar reminder to rotate access token in 60 days

---

## Quick Commands Reference

```bash
# View Instagram bot logs
pm2 logs instagram-bot

# Restart Instagram bot
pm2 restart instagram-bot

# View webhook logs
supabase functions logs instagram-webhook

# Query recent requests
supabase db query "SELECT instagram_username, keyword, status, created_at FROM collab_requests ORDER BY created_at DESC LIMIT 10;"

# Check bot status
pm2 status instagram-bot

# Stop bot
pm2 stop instagram-bot
```

---

## Success Criteria

✅ Webhook verified in Facebook dashboard
✅ Comment triggers webhook (visible in logs)
✅ Row inserted into `collab_requests` table
✅ Bot polls and claims request
✅ DM sent to commenter
✅ User receives registration link
✅ Both bots running on Oracle server (WhatsApp + Instagram)

---

**Deployment Complete!** 🎉

Your private ManyChat alternative is now live. The bot will automatically respond to PIETRA, AQUA, and CAÑADAS keywords with registration links.
