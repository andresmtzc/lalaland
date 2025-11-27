# Quick Webhook Fix - TL;DR

## The Problem
Payments work, but lots don't get marked as sold because the webhook secret is still set to test mode.

## The Fix (3 Steps)

### 1. Configure Webhook in Stripe (LIVE MODE)
1. Go to: https://dashboard.stripe.com/webhooks
2. **Switch to LIVE MODE** (toggle in top right)
3. Click "Add endpoint"
4. **Webhook URL**: `https://jmoxbhodpvnlmtihcwvt.supabase.co/functions/v1/stripe-webhook`
5. **Select event**: `payment_intent.succeeded`
6. Click "Add endpoint"

### 2. Get Live Webhook Secret
1. Click on the webhook you just created
2. Reveal the "Signing secret" (starts with `whsec_`)
3. Copy it

### 3. Update Supabase Secret
```bash
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_YOUR_LIVE_SECRET_HERE
supabase functions deploy stripe-webhook
```

## Test It
1. Make a test purchase
2. Lot should automatically be marked as "Sold"
3. Check Stripe Dashboard → Webhooks → Recent events for success (200 OK)

## Still Not Working?
Check logs:
```bash
supabase functions logs stripe-webhook
```

Look for:
- "Webhook signature verification failed" = wrong secret
- "Missing client_id" or "Missing lotName" = frontend issue

---

**Note**: Test mode and live mode have separate webhook endpoints with separate secrets. You can keep both active.
