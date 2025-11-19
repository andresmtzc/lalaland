# Supabase Edge Function Deployment Guide

## Prerequisites

1. **Install Supabase CLI**
   ```bash
   npm install -g supabase
   # or
   brew install supabase/tap/supabase
   ```

2. **Get Your Stripe Secret Key**
   - Go to https://dashboard.stripe.com/apikeys
   - Copy your **Secret key** (starts with `sk_test_` for test mode or `sk_live_` for production)

3. **Get Your Supabase Project Reference**
   - Go to https://app.supabase.com/projects
   - Select your project
   - Go to Settings > General
   - Copy your **Project Reference ID**

---

## Deployment Steps

### Step 1: Login to Supabase

```bash
supabase login
```

This will open a browser window to authenticate.

### Step 2: Link Your Project

```bash
cd /path/to/lalaland
supabase link --project-ref YOUR_PROJECT_REF_ID
```

Replace `YOUR_PROJECT_REF_ID` with your actual project reference from the Supabase dashboard.

### Step 3: Set Stripe Secret Key as Environment Variable

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_test_YOUR_STRIPE_SECRET_KEY
```

Replace with your actual Stripe secret key. This securely stores the key on Supabase.

### Step 4: Deploy the Edge Function

```bash
supabase functions deploy create-payment-intent
```

### Step 5: Get Your Edge Function URL

After deployment, you'll see output like:
```
Deployed Function create-payment-intent
Function URL: https://YOUR_PROJECT_REF.supabase.co/functions/v1/create-payment-intent
```

Copy this URL - you'll need it for the frontend configuration.

---

## Frontend Configuration

### Step 1: Update Stripe Publishable Key

In `inverta/index.html` (line ~8639), replace:

```javascript
const STRIPE_PUBLISHABLE_KEY = 'pk_test_YOUR_KEY_HERE';
```

With your actual Stripe publishable key from https://dashboard.stripe.com/apikeys

### Step 2: Update API Endpoint

In `inverta/index.html` (line ~8669), the Edge Function URL should already be set to:

```javascript
const response = await fetch('https://YOUR_PROJECT_REF.supabase.co/functions/v1/create-payment-intent', {
```

Replace `YOUR_PROJECT_REF` with your actual Supabase project reference ID.

---

## Testing

### Test Mode (Recommended First)

1. Use Stripe test keys (start with `pk_test_` and `sk_test_`)
2. Test with Stripe test cards:
   - Success: `4242 4242 4242 4242`
   - Decline: `4000 0000 0000 0002`
   - Requires 3D Secure: `4000 0025 0000 3155`
   - Expiry: Any future date
   - CVC: Any 3 digits
   - ZIP: Any 5 digits

### Production Mode

1. Switch to live Stripe keys (start with `pk_live_` and `sk_live_`)
2. Update the secret in Supabase:
   ```bash
   supabase secrets set STRIPE_SECRET_KEY=sk_live_YOUR_LIVE_KEY
   ```
3. Redeploy:
   ```bash
   supabase functions deploy create-payment-intent
   ```

---

## Troubleshooting

### Check Function Logs

```bash
supabase functions logs create-payment-intent
```

### Common Issues

1. **STRIPE_SECRET_KEY not configured**
   - Make sure you ran: `supabase secrets set STRIPE_SECRET_KEY=sk_test_...`

2. **CORS errors**
   - The function already includes CORS headers for all origins (`*`)
   - If you need to restrict, modify the `corsHeaders` in `index.ts`

3. **Payment fails**
   - Check the browser console for errors
   - Check Supabase function logs
   - Verify Stripe keys are correct and for the right mode (test vs live)

### Verify Environment Variables

```bash
supabase secrets list
```

---

## Local Development (Optional)

To test the function locally before deploying:

```bash
# Start local Supabase
supabase start

# Set local secret
supabase secrets set STRIPE_SECRET_KEY=sk_test_YOUR_KEY --env-file supabase/.env.local

# Serve function locally
supabase functions serve create-payment-intent

# Function will be available at:
# http://localhost:54321/functions/v1/create-payment-intent
```

---

## Security Notes

- ✅ Never commit Stripe secret keys to Git
- ✅ Use environment variables (secrets) for all sensitive keys
- ✅ Use test mode first before going live
- ✅ The publishable key (`pk_`) is safe to include in frontend code
- ✅ The secret key (`sk_`) must ONLY be in the Edge Function (server-side)

---

## Support

- Supabase Docs: https://supabase.com/docs/guides/functions
- Stripe Docs: https://stripe.com/docs/payments/payment-intents
- Edge Function Reference: https://supabase.com/docs/guides/functions/quickstart
