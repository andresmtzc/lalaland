// Supabase Edge Function for Instagram Graph API Webhooks
// Handles comment notifications and triggers collab bot automation
// Deploy with: supabase functions deploy instagram-webhook

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Keyword to client mapping
const KEYWORD_TO_CLIENT: Record<string, string> = {
  'PIETRA': 'inverta',
  'AQUA': 'inverta',
  'CAÑADAS': 'inverta',
}

// Base URL for registration forms
const BASE_URL = 'https://la-la.land'

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)

    // GET request: Webhook verification (Instagram setup)
    if (req.method === 'GET') {
      const mode = url.searchParams.get('hub.mode')
      const token = url.searchParams.get('hub.verify_token')
      const challenge = url.searchParams.get('hub.challenge')

      const verifyToken = Deno.env.get('INSTAGRAM_VERIFY_TOKEN')

      if (mode === 'subscribe' && token === verifyToken) {
        console.log('✅ Instagram webhook verified')
        return new Response(challenge, {
          status: 200,
          headers: { 'Content-Type': 'text/plain' }
        })
      } else {
        console.error('❌ Webhook verification failed')
        return new Response('Forbidden', { status: 403 })
      }
    }

    // POST request: Incoming webhook notification
    if (req.method === 'POST') {
      // Verify signature
      const signature = req.headers.get('x-hub-signature-256')
      const appSecret = Deno.env.get('INSTAGRAM_APP_SECRET')

      if (signature && appSecret) {
        const body = await req.text()
        const expectedSignature = await generateSignature(body, appSecret)

        if (signature !== expectedSignature) {
          console.error('❌ Invalid signature')
          return new Response('Invalid signature', { status: 403 })
        }

        // Parse the verified body
        const payload = JSON.parse(body)
        await processWebhook(payload)
      } else {
        // No signature verification (development mode)
        console.warn('⚠️ Processing webhook without signature verification')
        const payload = await req.json()
        await processWebhook(payload)
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response('Method not allowed', { status: 405 })

  } catch (error) {
    console.error('❌ Webhook error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

async function generateSignature(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(payload)
  )

  const hashArray = Array.from(new Uint8Array(signature))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

  return `sha256=${hashHex}`
}

async function processWebhook(payload: any) {
  console.log('📩 Webhook received:', JSON.stringify(payload, null, 2))

  // Initialize Supabase client with service role key (full access)
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Instagram webhook structure:
  // { object: 'instagram', entry: [...] }
  if (payload.object !== 'instagram') {
    console.log('⏭️ Skipping non-Instagram webhook')
    return
  }

  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      // We're interested in 'comments' field
      if (change.field === 'comments') {
        const commentData = change.value

        // Extract comment details
        const commentId = commentData.id
        const commentText = commentData.text || ''
        const instagramUserId = commentData.from?.id
        const instagramUsername = commentData.from?.username
        const postId = commentData.media?.id

        console.log(`💬 Comment from @${instagramUsername}: "${commentText}"`)

        // Check if comment contains a keyword (exact match, caps only)
        const keyword = findKeyword(commentText)

        if (keyword) {
          const clientId = KEYWORD_TO_CLIENT[keyword]
          const formLink = `${BASE_URL}/${clientId}/registro.html`

          console.log(`✅ Keyword "${keyword}" detected → Client: ${clientId}`)

          // Insert into collab_requests table
          const { data, error } = await supabase
            .from('collab_requests')
            .insert({
              instagram_user_id: instagramUserId,
              instagram_username: instagramUsername,
              post_id: postId,
              comment_id: commentId,
              comment_text: commentText,
              keyword: keyword,
              client_id: clientId,
              form_link: formLink,
              status: 'pending',
              post_type: commentData.media?.media_product_type || 'POST',
            })
            .select()
            .single()

          if (error) {
            // Check if it's a duplicate (unique constraint violation)
            if (error.code === '23505') {
              console.log(`⏭️ Comment ${commentId} already processed, skipping`)
            } else {
              console.error('❌ Error inserting collab_request:', error)
            }
          } else {
            console.log(`✅ Collab request created: ${data.id}`)
          }
        } else {
          console.log(`⏭️ No matching keyword in comment: "${commentText}"`)
        }
      }
    }
  }
}

function findKeyword(text: string): string | null {
  // Check for exact keyword matches (case-sensitive, caps only)
  const keywords = Object.keys(KEYWORD_TO_CLIENT)

  for (const keyword of keywords) {
    // Match whole word only (not partial)
    const regex = new RegExp(`\\b${keyword}\\b`)
    if (regex.test(text)) {
      return keyword
    }
  }

  return null
}
