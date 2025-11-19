// Supabase Edge Function for Stripe Webhook
// Handles payment_intent.succeeded events to update lot status
// Deploy with: supabase functions deploy stripe-webhook

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from 'https://esm.sh/stripe@14.11.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('Webhook received:', req.method, req.url)

    // Get Stripe secret key and webhook secret from environment
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')

    console.log('Environment check:', {
      hasStripeKey: !!stripeSecretKey,
      hasWebhookSecret: !!webhookSecret
    })

    if (!stripeSecretKey || !webhookSecret) {
      console.error('Missing configuration:', {
        stripeKey: !!stripeSecretKey,
        webhookSecret: !!webhookSecret
      })
      return new Response(
        JSON.stringify({ error: 'Stripe keys not configured' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    })

    // Get the signature from headers
    const signature = req.headers.get('stripe-signature')
    if (!signature) {
      return new Response(
        JSON.stringify({ error: 'No stripe-signature header' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get raw body for signature verification
    const body = await req.text()

    // Verify webhook signature
    let event: Stripe.Event
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message)
      return new Response(
        JSON.stringify({ error: 'Webhook signature verification failed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Webhook event type:', event.type)

    // Handle payment_intent.succeeded event
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent

      console.log('Payment succeeded:', paymentIntent.id)
      console.log('Metadata:', paymentIntent.metadata)

      // Extract lot information from metadata
      const { lotNumber, lotName } = paymentIntent.metadata

      if (!lotName) {
        console.error('No lotName in payment intent metadata')
        return new Response(
          JSON.stringify({ error: 'Missing lotName in metadata' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Initialize Supabase client with service role key (bypasses RLS)
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

      const supabase = createClient(supabaseUrl, supabaseServiceKey)

      // Update lot status to Sold
      const { error: updateError } = await supabase
        .from('lots')
        .update({ availability: 'Sold' })
        .eq('lot_name', lotName)
        .eq('client_id', 'inverta')

      if (updateError) {
        console.error('Error updating lot status:', updateError)
        throw updateError
      }

      console.log(`Successfully marked lot ${lotNumber} (${lotName}) as Sold`)
    }

    // Return success response
    return new Response(
      JSON.stringify({ received: true }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Webhook error:', error)

    return new Response(
      JSON.stringify({
        error: error.message || 'Webhook processing failed'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
