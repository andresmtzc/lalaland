// Instagram Collab Bot
// Polls Supabase for pending collab_requests and sends DMs via Instagram Graph API
// Run with: node instagram-bot.js

const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

// ========================================
// CONFIGURATION
// ========================================

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://jmoxbhodpvnlmtihcwvt.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY; // Service role key for bot access
const INSTAGRAM_ACCESS_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN; // Long-lived Instagram access token
const INSTAGRAM_PAGE_ID = process.env.INSTAGRAM_PAGE_ID; // Instagram Business Account ID

const POLL_INTERVAL = 3000; // 3 seconds (same as WhatsApp link polling)
const RATE_LIMIT_DELAY = 2000; // 2 seconds between DMs to avoid rate limits

// DM message template
const DM_MESSAGE_TEMPLATE = `¡Hola! Muchas gracias por tu interés. Regístrate aquí:
{FORM_LINK}
Y muy pronto recibirás más información via Whatsapp.`;

// ========================================
// SUPABASE CLIENT
// ========================================

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_KEY environment variable is required');
  process.exit(1);
}

if (!INSTAGRAM_ACCESS_TOKEN) {
  console.error('❌ INSTAGRAM_ACCESS_TOKEN environment variable is required');
  process.exit(1);
}

if (!INSTAGRAM_PAGE_ID) {
  console.error('❌ INSTAGRAM_PAGE_ID environment variable is required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

console.log('🤖 Instagram Collab Bot starting...');
console.log(`📊 Polling interval: ${POLL_INTERVAL}ms`);
console.log(`🔐 Instagram Page ID: ${INSTAGRAM_PAGE_ID}`);

// ========================================
// INSTAGRAM GRAPH API
// ========================================

/**
 * Send a DM to an Instagram user via Graph API
 * @param {string} recipientId - Instagram user ID (IGSID)
 * @param {string} message - Message text to send
 * @returns {Promise<Object>} Response from Instagram API
 */
async function sendInstagramDM(recipientId, message) {
  const url = `https://graph.facebook.com/v21.0/${INSTAGRAM_PAGE_ID}/messages`;

  const payload = {
    recipient: {
      id: recipientId,
    },
    message: {
      text: message,
    },
  };

  try {
    const response = await axios.post(url, payload, {
      headers: {
        'Content-Type': 'application/json',
      },
      params: {
        access_token: INSTAGRAM_ACCESS_TOKEN,
      },
    });

    console.log(`✅ DM sent to ${recipientId}:`, response.data);
    return response.data;
  } catch (error) {
    console.error(`❌ Failed to send DM to ${recipientId}:`, error.response?.data || error.message);
    throw error;
  }
}

// ========================================
// COLLAB REQUEST PROCESSING
// ========================================

/**
 * Process a single collab request
 * @param {Object} request - Collab request from database
 */
async function processCollabRequest(request) {
  const {
    id,
    instagram_user_id,
    instagram_username,
    keyword,
    form_link,
    comment_text,
  } = request;

  console.log(`\n📨 Processing request ${id}`);
  console.log(`   User: @${instagram_username} (${instagram_user_id})`);
  console.log(`   Keyword: ${keyword}`);
  console.log(`   Comment: "${comment_text}"`);

  try {
    // Build the DM message
    const message = DM_MESSAGE_TEMPLATE.replace('{FORM_LINK}', form_link);

    // Send the DM
    await sendInstagramDM(instagram_user_id, message);

    // Mark as completed
    const { error: updateError } = await supabase
      .from('collab_requests')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      console.error(`❌ Failed to update request ${id}:`, updateError);
    } else {
      console.log(`✅ Request ${id} completed successfully`);
    }

    // Rate limit delay
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));

  } catch (error) {
    // Mark as error
    const { error: updateError } = await supabase
      .from('collab_requests')
      .update({
        status: 'error',
        error_message: error.message || 'Failed to send DM',
        completed_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      console.error(`❌ Failed to update error status for ${id}:`, updateError);
    }

    console.error(`❌ Request ${id} failed:`, error.message);
  }
}

/**
 * Poll Supabase for pending collab requests
 */
async function checkPendingCollabRequests() {
  try {
    // Atomic claim pattern: Update status to 'processing' and return the claimed row
    const { data: claimedRequests, error } = await supabase
      .from('collab_requests')
      .update({ status: 'processing' })
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(1)
      .select();

    if (error) {
      console.error('❌ Error querying collab_requests:', error);
      return;
    }

    if (claimedRequests && claimedRequests.length > 0) {
      for (const request of claimedRequests) {
        await processCollabRequest(request);
      }
    }
  } catch (error) {
    console.error('❌ Error in checkPendingCollabRequests:', error);
  }
}

/**
 * Start the polling loop
 */
function startPolling() {
  console.log('🔄 Starting collab request polling...\n');

  setInterval(async () => {
    await checkPendingCollabRequests();
  }, POLL_INTERVAL);

  // Initial check
  checkPendingCollabRequests();
}

// ========================================
// GRACEFUL SHUTDOWN
// ========================================

process.on('SIGINT', () => {
  console.log('\n👋 Instagram bot shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 Instagram bot shutting down...');
  process.exit(0);
});

// ========================================
// START BOT
// ========================================

startPolling();

console.log('✅ Instagram Collab Bot is running');
console.log('   Press Ctrl+C to stop\n');
