# Stripe Webhook Fix for Live Mode

## Problem
After switching to Stripe live mode, payments work but lots are not automatically marked as sold. This is because the webhook secret needs to be updated for live mode.

## Solution

### Step 1: Configure Webhook in Stripe Dashboard (Live Mode)

1. Go to: https://dashboard.stripe.com/webhooks
2. Make sure you're in **LIVE MODE** (toggle in top right)
3. Click **"Add endpoint"**
4. Enter your webhook URL:
   ```
   https://YOUR_PROJECT_REF.supabase.co/functions/v1/stripe-webhook
   ```
   Replace `YOUR_PROJECT_REF` with your Supabase project reference ID

5. Under **"Events to send"**, select:
   - `payment_intent.succeeded`

6. Click **"Add endpoint"**

### Step 2: Get the Webhook Signing Secret

1. After creating the webhook, you'll see it in the list
2. Click on the webhook endpoint you just created
3. In the **"Signing secret"** section, click **"Reveal"**
4. Copy the secret (starts with `whsec_`)
   - This is your **LIVE mode webhook secret**
   - It's different from the test mode secret!

### Step 3: Update Supabase Secrets

Run these commands in your terminal:

```bash
# Update the webhook secret to the LIVE mode secret
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_YOUR_LIVE_WEBHOOK_SECRET

# Verify it's using the live secret key (should already be set)
supabase secrets set STRIPE_SECRET_KEY=sk_live_YOUR_LIVE_SECRET_KEY
```

### Step 4: Redeploy the Webhook Function

```bash
supabase functions deploy stripe-webhook
```

### Step 5: Test the Webhook

1. In Stripe Dashboard → Webhooks → Your endpoint
2. Click **"Send test webhook"**
3. Select **"payment_intent.succeeded"**
4. Click **"Send test event"**
5. You should see a **200 OK** response

### Step 6: Test with Real Payment

1. Make a test purchase on your site with a real card
2. After payment succeeds, check:
   - The lot should automatically be marked as "Sold"
   - An X should appear on the lot
   - Check `lot_updates_audit` table for the record

## Verification Checklist

- [ ] Webhook endpoint created in Stripe **LIVE MODE**
- [ ] Webhook is listening for `payment_intent.succeeded` events
- [ ] `STRIPE_WEBHOOK_SECRET` updated with **LIVE** mode secret (whsec_...)
- [ ] `STRIPE_SECRET_KEY` is set to **LIVE** mode key (sk_live_...)
- [ ] `stripe-webhook` function redeployed
- [ ] Test webhook returns 200 OK
- [ ] Real payment marks lot as sold

## Troubleshooting

### Check Webhook Logs
```bash
supabase functions logs stripe-webhook
```

### Check Stripe Webhook Attempts
1. Go to Stripe Dashboard → Webhooks
2. Click your endpoint
3. Check the **"Recent events"** tab
4. Look for any failed attempts (red X)
5. Click on them to see error messages

### Common Issues

**"Webhook signature verification failed"**
- This means `STRIPE_WEBHOOK_SECRET` is incorrect or still set to test mode
- Make sure you copied the **live mode** webhook secret (not test mode)

**"Missing client_id in metadata"**
- The payment intent needs to include `client_id` in metadata
- Check `create-payment-intent` function is passing this

**"No lotName in payment intent metadata"**
- The payment intent needs lot information
- Verify the frontend is passing `lotName` and `lotNumber`

## Quick Reference

### Environment Variables Needed
```
STRIPE_SECRET_KEY=sk_live_...         (Live mode secret key)
STRIPE_WEBHOOK_SECRET=whsec_...       (Live mode webhook signing secret)
```

### Webhook Endpoint URL Format
```
https://YOUR_PROJECT_REF.supabase.co/functions/v1/stripe-webhook
```

### Events to Listen For
- `payment_intent.succeeded`

---

## Notes

- Test mode and live mode have **separate** webhook endpoints
- Each webhook endpoint has its **own signing secret**
- You can keep your test mode webhook active for testing
- The webhook function uses the same code for both modes
- Only the secrets need to change when switching modes
