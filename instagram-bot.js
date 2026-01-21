// Instagram Collab Bot - Hybrid Approach
// Webhook detects comments → Bot polls Supabase → Sends DMs
// Run with: node instagram-bot.js

const { IgApiClient } = require('instagram-private-api');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// ========================================
// CONFIGURATION
// ========================================

const INSTAGRAM_USERNAME = process.env.INSTAGRAM_USERNAME; // @la_la.land___
const INSTAGRAM_PASSWORD = process.env.INSTAGRAM_PASSWORD;
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://jmoxbhodpvnlmtihcwvt.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const SESSION_FILE = path.join(__dirname, 'instagram_session.json');
const POLL_INTERVAL = 3000; // Poll Supabase every 3 seconds
const RATE_LIMIT_DELAY = 2000; // 2 seconds between DMs

// DM message template
const DM_MESSAGE_TEMPLATE = `¡Hola! Muchas gracias por tu interés. Regístrate aquí:
{FORM_LINK}
Y muy pronto recibirás más información via Whatsapp.`;

// ========================================
// VALIDATION
// ========================================

if (!INSTAGRAM_USERNAME || !INSTAGRAM_PASSWORD) {
  console.error('❌ INSTAGRAM_USERNAME and INSTAGRAM_PASSWORD environment variables are required');
  process.exit(1);
}

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_KEY environment variable is required');
  process.exit(1);
}

const ig = new IgApiClient();
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

console.log('🤖 Instagram Collab Bot (Hybrid Mode) starting...');
console.log(`📱 Account: @${INSTAGRAM_USERNAME}`);

// ========================================
// INSTAGRAM SESSION MANAGEMENT
// ========================================

/**
 * Save session to file for reuse
 */
async function saveSession() {
  const cookies = await ig.state.serializeCookieJar();
  fs.writeFileSync(SESSION_FILE, JSON.stringify(cookies));
  console.log('💾 Session saved');
}

/**
 * Load session from file
 */
async function loadSession() {
  if (fs.existsSync(SESSION_FILE)) {
    try {
      const cookies = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'));
      await ig.state.deserializeCookieJar(cookies);
      console.log('✅ Session loaded from file');
      return true;
    } catch (error) {
      console.log('⚠️  Failed to load session, will login fresh');
      return false;
    }
  }
  return false;
}

/**
 * Login to Instagram
 */
async function login() {
  ig.state.generateDevice(INSTAGRAM_USERNAME);

  // Try to load existing session first
  const sessionLoaded = await loadSession();

  if (sessionLoaded) {
    try {
      // Verify session is still valid
      await ig.account.currentUser();
      console.log('✅ Session is valid, logged in!');
      return;
    } catch (error) {
      console.log('⚠️  Session expired, logging in fresh...');
    }
  }

  // Fresh login
  console.log('🔐 Logging in to Instagram...');
  await ig.simulate.preLoginFlow();
  const auth = await ig.account.login(INSTAGRAM_USERNAME, INSTAGRAM_PASSWORD);
  console.log(`✅ Logged in as @${auth.username} (ID: ${auth.pk})`);

  // Skip postLoginFlow - Instagram API changed
  await saveSession();
}

// ========================================
// SUPABASE POLLING & DM SENDING
// ========================================

/**
 * Poll Supabase for pending collab requests
 */
async function checkPendingRequests() {
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
        await processRequest(request);
      }
    }
  } catch (error) {
    console.error('❌ Error in checkPendingRequests:', error);
  }
}

/**
 * Process a single collab request
 */
async function processRequest(request) {
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

    // Send DM
    await sendDM(instagram_user_id, instagram_username, message);

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
 * Send Instagram DM
 */
async function sendDM(userId, username, message) {
  try {
    // Create thread with user
    const thread = ig.entity.directThread([userId.toString()]);

    // Send as plain text (don't let library auto-detect links)
    await thread.broadcastText(message);

    console.log(`✅ DM sent to @${username}`);
  } catch (error) {
    // If broadcastText fails, try the raw API
    console.log(`⚠️  Trying alternative method...`);
    try {
      await ig.directThread.broadcastText({
        recipients: [userId.toString()],
        text: message
      });
      console.log(`✅ DM sent to @${username} (alternative method)`);
    } catch (error2) {
      console.error(`❌ Failed to send DM to @${username}:`, error.message);
      throw error;
    }
  }
}

// ========================================
// MAIN LOOP
// ========================================

/**
 * Start polling Supabase
 */
function startPolling() {
  console.log('🔄 Starting Supabase polling...\n');
  console.log(`📊 Polling interval: ${POLL_INTERVAL / 1000} seconds`);
  console.log(`📥 Watching for pending collab_requests...\n`);

  // Check immediately
  checkPendingRequests();

  // Then check periodically
  setInterval(async () => {
    await checkPendingRequests();
  }, POLL_INTERVAL);
}

// ========================================
// GRACEFUL SHUTDOWN
// ========================================

process.on('SIGINT', async () => {
  console.log('\n👋 Instagram bot shutting down...');
  await saveSession();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n👋 Instagram bot shutting down...');
  await saveSession();
  process.exit(0);
});

// ========================================
// START BOT
// ========================================

(async () => {
  try {
    await login();
    startPolling();
    console.log('✅ Instagram Collab Bot is running');
    console.log('   Webhook detects comments → Bot sends DMs');
    console.log('   Press Ctrl+C to stop\n');
  } catch (error) {
    console.error('❌ Failed to start bot:', error);
    process.exit(1);
  }
})();

