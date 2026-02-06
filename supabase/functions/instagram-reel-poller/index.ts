// Supabase Edge Function: Instagram Reel Comment Poller
// Fills the gap where Instagram webhooks don't fire for collab reel comments.
// Called via pg_cron every 5 minutes.
// Deploy with: supabase functions deploy instagram-reel-poller

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

// --- SHARED CONFIG (same as instagram-webhook) ---

const KEYWORD_TO_CLIENT: Record<string, string> = {
  'pietra': 'agora',
  'peitra': 'agora',
  'petra': 'agora',
  'pitra': 'agora',
  'piedra': 'agora',
  'prieta': 'agora',
  'aqua': 'agora',
  'cañadas': 'agora',
}

const BASE_URL = 'https://la-la.land'
const GRAPH_API = 'https://graph.facebook.com/v21.0'

// Only check reels posted in the last 7 days
const REELS_MAX_AGE_DAYS = 7

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const accessToken = Deno.env.get('INSTAGRAM_ACCESS_TOKEN')
    if (!accessToken) {
      console.error('❌ Missing INSTAGRAM_ACCESS_TOKEN')
      return new Response(JSON.stringify({ error: 'Missing access token' }), { status: 500 })
    }

    // --- Read last poll timestamp ---
    const { data: stateRow } = await supabase
      .from('poller_state')
      .select('last_polled_at')
      .eq('id', 'reel_poller')
      .single()

    const lastPolledAt = stateRow?.last_polled_at
      ? new Date(stateRow.last_polled_at)
      : null

    const pollStartTime = new Date().toISOString()

    console.log(`🕐 Last polled: ${lastPolledAt?.toISOString() || 'never (first run)'}`)

    // 1. Fetch recent media
    const mediaRes = await fetch(
      `${GRAPH_API}/me/media?fields=id,media_product_type,timestamp&limit=25&access_token=${accessToken}`
    )
    const mediaData = await mediaRes.json()

    if (mediaData.error) {
      console.error('❌ Graph API error fetching media:', mediaData.error)
      return new Response(JSON.stringify({ error: mediaData.error.message }), { status: 500 })
    }

    // 2. Filter for recent reels only
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - REELS_MAX_AGE_DAYS)

    const reels = (mediaData.data || []).filter((m: any) =>
      m.media_product_type === 'REELS' && new Date(m.timestamp) > cutoff
    )

    console.log(`📹 Found ${reels.length} recent reels to check`)

    let processed = 0
    let skippedOld = 0

    // 3. Check comments on each reel (paginated, newest-first, skip old)
    for (const reel of reels) {
      let commentsUrl: string | null =
        `${GRAPH_API}/${reel.id}/comments?fields=id,text,from{id,username},timestamp&limit=50&order=reverse_chronological&access_token=${accessToken}`

      let doneWithReel = false

      while (commentsUrl && !doneWithReel) {
        const commentsRes = await fetch(commentsUrl)
        const commentsData = await commentsRes.json()

        if (commentsData.error) {
          console.error(`❌ Error fetching comments for reel ${reel.id}:`, commentsData.error)
          break
        }

        for (const comment of commentsData.data || []) {
          // Skip comments older than last poll (we already checked them)
          if (lastPolledAt && new Date(comment.timestamp) <= lastPolledAt) {
            skippedOld++
            doneWithReel = true
            break
          }

          // Check for keyword (cheap, no DB call)
          const keyword = findKeyword(comment.text || '')
          if (!keyword) continue

          // Check if already processed (dedup safety net)
          const { data: existing } = await supabase
            .from('collab_requests')
            .select('id')
            .eq('comment_id', comment.id)
            .maybeSingle()

          if (existing) continue

          // New keyword comment on a reel — process it!
          const clientId = KEYWORD_TO_CLIENT[keyword]
          const formLink = `${BASE_URL}/${clientId}/registro.html`
          const username = comment.from?.username || 'amigo'

          console.log(`✅ Reel keyword "${keyword}" from @${username} on reel ${reel.id}`)

          // --- STEP A: Private Reply ---
          const privateMessage = `¡Hola! Por favor compártenos tu WhatsApp en esta liga:\n\n${formLink}\n\nY un asesor de ${clientId.toUpperCase()} te va contactar muy pronto.`
          const dmSuccess = await sendPrivateReply(comment.id, privateMessage, accessToken)

          // --- STEP B: Public Reply ---
          const publicReply = dmSuccess
            ? `@${username} ¡Te envié la info por DM! 📩`
            : `@${username} ¡Hola! Por favor envíame un DM para pasarte el link.`
          await replyToComment(comment.id, publicReply, accessToken)

          // --- STEP C: Log to Supabase ---
          const { error } = await supabase
            .from('collab_requests')
            .insert({
              instagram_user_id: comment.from?.id,
              instagram_username: username,
              post_id: reel.id,
              comment_id: comment.id,
              comment_text: comment.text,
              keyword: keyword,
              client_id: clientId,
              form_link: formLink,
              status: dmSuccess ? 'dm_sent' : 'failed_dm_privacy',
              completed_at: new Date().toISOString(),
              post_type: 'REELS',
            })

          if (error && error.code !== '23505') {
            console.error('❌ Error inserting collab_request:', error)
          }

          processed++
        }

        // Next page (if any and we haven't hit old comments)
        commentsUrl = doneWithReel ? null : (commentsData.paging?.next || null)
      }
    }

    // --- Update last poll timestamp ---
    await supabase
      .from('poller_state')
      .upsert({ id: 'reel_poller', last_polled_at: pollStartTime })

    console.log(`✅ Poll complete. Reels: ${reels.length}, new keywords: ${processed}, skipped old: ${skippedOld}`)

    return new Response(
      JSON.stringify({ success: true, reels_checked: reels.length, processed, skipped_old: skippedOld }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Reel poller error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})

// ------------------------------------------------------------------
// HELPER FUNCTIONS
// ------------------------------------------------------------------

async function sendPrivateReply(commentId: string, messageText: string, accessToken: string): Promise<boolean> {
  try {
    const response = await fetch(`${GRAPH_API}/me/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { comment_id: commentId },
        message: { text: messageText },
        access_token: accessToken,
      }),
    })

    const data = await response.json()
    if (response.ok) {
      console.log(`✅ Private Reply sent for comment ${commentId}`)
      return true
    } else {
      console.error(`❌ Private Reply failed:`, data)
      return false
    }
  } catch (error) {
    console.error(`❌ Error sending Private Reply:`, error)
    return false
  }
}

async function replyToComment(commentId: string, replyText: string, accessToken: string) {
  try {
    const response = await fetch(`${GRAPH_API}/${commentId}/replies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: replyText, access_token: accessToken }),
    })

    if (response.ok) {
      console.log(`✅ Public reply sent to ${commentId}`)
    } else {
      const data = await response.json()
      console.error(`❌ Public reply failed:`, data)
    }
  } catch (error) {
    console.error(`❌ Error public reply:`, error)
  }
}

function findKeyword(text: string): string | null {
  const lowerText = text.toLowerCase()
  const keywords = Object.keys(KEYWORD_TO_CLIENT)

  for (const keyword of keywords) {
    const regex = new RegExp(`\\b${keyword.toLowerCase()}\\b`)
    if (regex.test(lowerText)) {
      return keyword
    }
  }
  return null
}
