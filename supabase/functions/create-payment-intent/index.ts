// Supabase Edge Function for creating Stripe Payment Intents
// Deploy with: supabase functions deploy create-payment-intent

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from 'https://esm.sh/stripe@14.11.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const authHeader = req.headers.get('Authorization')

    // Create Supabase client with auth header if provided
    const supabase = createClient(supabaseUrl, supabaseKey,
      authHeader ? { global: { headers: { Authorization: authHeader } } } : {}
    )

    // Get authenticated user if auth header is provided (optional for public payments)
    let user = null
    if (authHeader) {
      const { data: authData, error: authError } = await supabase.auth.getUser()
      if (!authError && authData) {
        user = authData.user
      }
    }

    // Get Stripe secret key from environment
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeSecretKey) {
      throw new Error('STRIPE_SECRET_KEY not configured')
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    })

    // Parse request body
    const { amount, lotNumber, lotName, lotId, client_id } = await req.json()

    // Validate input
    if (!amount || !lotNumber || !client_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: amount, lotNumber, client_id' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // SECURITY: If user is authenticated, validate they have access to the requested client_id
    if (user) {
      const { data: editorAccess, error: accessError } = await supabase
        .from('editors')
        .select('id')
        .eq('user_id', user.id)
        .eq('client_id', client_id)
        .maybeSingle()

      if (accessError || !editorAccess) {
        console.warn(`User ${user.email} attempted unauthorized access to client: ${client_id}`)
        return new Response(
          JSON.stringify({ error: 'Unauthorized: No access to this client' }),
          {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }
    }

    // Create Payment Intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount), // Amount in cents
      currency: 'mxn', // Mexican Peso
      payment_method_types: ['card'], // Only allow card payments, excludes Link
      metadata: {
        lotNumber: lotNumber,
        lotName: lotName || '', // lot_name for database update (e.g., "lotinverta17-17")
        lotId: lotId || '',
        client_id: client_id, // Store client_id for webhook processing
        user_email: user?.email || 'guest', // Store user email or 'guest' for non-authenticated purchases
      },
      description: `Apartado de Lote ${lotNumber} - ${client_id.toUpperCase()}`,
    })

    // Return client secret
    return new Response(
      JSON.stringify({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error creating payment intent:', error)

    return new Response(
      JSON.stringify({
        error: error.message || 'Failed to create payment intent'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
