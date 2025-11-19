# Supabase Edge Functions

This directory contains Supabase Edge Functions for the INVERTA application.

## 📁 Structure

```
supabase/
├── functions/
│   └── create-payment-intent/    # Stripe payment processing
│       └── index.ts
├── config.toml                    # Supabase configuration
├── DEPLOYMENT.md                  # 📖 Complete deployment guide
└── README.md                      # This file
```

## 🚀 Quick Start

**For complete deployment instructions, see [DEPLOYMENT.md](./DEPLOYMENT.md)**

### Deploy in 3 steps:

1. **Login & Link**
   ```bash
   supabase login
   supabase link --project-ref YOUR_PROJECT_REF_ID
   ```

2. **Set Stripe Secret**
   ```bash
   supabase secrets set STRIPE_SECRET_KEY=sk_test_YOUR_KEY
   ```

3. **Deploy**
   ```bash
   supabase functions deploy create-payment-intent
   ```

## 🔧 Functions

### `create-payment-intent`

Creates Stripe Payment Intents for lot reservations.

- **Endpoint**: `https://YOUR_PROJECT.supabase.co/functions/v1/create-payment-intent`
- **Method**: POST
- **Input**: `{ amount: number, lotNumber: string, lotId: string }`
- **Output**: `{ clientSecret: string, paymentIntentId: string }`

## 📚 Resources

- [Full Deployment Guide](./DEPLOYMENT.md)
- [Supabase Functions Docs](https://supabase.com/docs/guides/functions)
- [Stripe Payment Intents](https://stripe.com/docs/payments/payment-intents)
