// Instagram Collab Bot - Using instagram-private-api (Unofficial)
// Works like WhatsApp Baileys - direct Instagram connection, no Facebook BS
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
const CHECK_INTERVAL = 10000; // Check for new comments every 10 seconds

// Keyword to client mapping
const KEYWORD_TO_CLIENT = {
  'PIETRA': 'inverta',
  'AQUA': 'inverta',
  'CAÑADAS': 'inverta',
};

// DM message template
const DM_MESSAGE_TEMPLATE = `¡Hola! Muchas gracias por tu interés. Regístrate aquí:
{FORM_LINK}
Y muy pronto recibirás más información via Whatsapp.`;

// Track processed comments (in-memory)
const processedComments = new Set();

// ========================================
// VALIDATION
// ========================================

if (!INSTAGRAM_USERNAME || !INSTAGRAM_PASSWORD) {
  console.error('❌ INSTAGRAM_USERNAME and INSTAGRAM_PASSWORD environment variables are required');
  process.exit(1);
}

const ig = new IgApiClient();
const supabase = SUPABASE_SERVICE_KEY ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY) : null;

console.log('🤖 Instagram Collab Bot (Unofficial API) starting...');
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

  // await ig.simulate.postLoginFlow(); // Skip - Instagram API changed, endpoint returns 404
  await saveSession();
}

// ========================================
// COMMENT MONITORING
// ========================================

/**
 * Check recent media for new comments with keywords
 */
async function checkRecentComments() {
  try {
    // Get user's own media feed
    const userFeed = ig.feed.user(ig.state.cookieUserId);
    const items = await userFeed.items();

    // Check last 10 posts for comments
    for (const item of items.slice(0, 10)) {
      await checkMediaComments(item.pk, item.code);
    }
  } catch (error) {
    console.error('❌ Error checking comments:', error.message);
  }
}

/**
 * Check comments on a specific media item
 */
async function checkMediaComments(mediaPk, mediaCode) {
  try {
    const commentsFeed = ig.feed.mediaComments(mediaPk);
    const comments = await commentsFeed.items();

    for (const comment of comments) {
      await processComment(comment, mediaPk, mediaCode);
    }
  } catch (error) {
    // Silently ignore errors for individual posts
    // (some posts might not allow comments, etc.)
  }
}

/**
 * Process a single comment
 */
async function processComment(comment, mediaPk, mediaCode) {
  const commentId = comment.pk;
  const commentText = comment.text || '';
  const username = comment.user.username;
  const userId = comment.user.pk;

  // Skip if already processed
  if (processedComments.has(commentId)) {
    return;
  }

  // Check for keywords
  const keyword = findKeyword(commentText);

  if (keyword) {
    console.log(`\n💬 Keyword detected!`);
    console.log(`   Post: https://instagram.com/p/${mediaCode}`);
    console.log(`   User: @${username} (${userId})`);
    console.log(`   Comment: "${commentText}"`);
    console.log(`   Keyword: ${keyword}`);

    // Mark as processed
    processedComments.add(commentId);

    // Get client and form link
    const clientId = KEYWORD_TO_CLIENT[keyword];
    const formLink = `https://la-la.land/${clientId}/registro.html`;

    // Log to Supabase (optional)
    if (supabase) {
      await logToSupabase(commentId, userId, username, mediaPk, commentText, keyword, clientId, formLink);
    }

    // Send DM
    await sendDM(userId, username, formLink);
  }
}

/**
 * Find keyword in comment text
 */
function findKeyword(text) {
  const keywords = Object.keys(KEYWORD_TO_CLIENT);

  for (const keyword of keywords) {
    // Match whole word only (not partial)
    const regex = new RegExp(`\\b${keyword}\\b`);
    if (regex.test(text)) {
      return keyword;
    }
  }

  return null;
}

/**
 * Send Instagram DM
 */
async function sendDM(userId, username, formLink) {
  try {
    const message = DM_MESSAGE_TEMPLATE.replace('{FORM_LINK}', formLink);

    const thread = ig.entity.directThread([userId.toString()]);
    await thread.broadcastText(message);

    console.log(`✅ DM sent to @${username}`);

    // Small delay to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 2000));
  } catch (error) {
    console.error(`❌ Failed to send DM to @${username}:`, error.message);
  }
}

/**
 * Log request to Supabase
 */
async function logToSupabase(commentId, userId, username, postId, commentText, keyword, clientId, formLink) {
  try {
    await supabase.from('collab_requests').insert({
      comment_id: commentId.toString(),
      instagram_user_id: userId.toString(),
      instagram_username: username,
      post_id: postId.toString(),
      comment_text: commentText,
      keyword: keyword,
      client_id: clientId,
      form_link: formLink,
      status: 'completed',
      completed_at: new Date().toISOString(),
    });
  } catch (error) {
    // Ignore duplicate errors (comment already logged)
    if (error.code !== '23505') {
      console.error('⚠️  Failed to log to Supabase:', error.message);
    }
  }
}

// ========================================
// MAIN LOOP
// ========================================

/**
 * Start monitoring for comments
 */
function startMonitoring() {
  console.log('🔄 Starting comment monitoring...\n');
  console.log(`📊 Checking for comments every ${CHECK_INTERVAL / 1000} seconds`);
  console.log(`🔑 Watching keywords: ${Object.keys(KEYWORD_TO_CLIENT).join(', ')}\n`);

  // Check immediately
  checkRecentComments();

  // Then check periodically
  setInterval(async () => {
    await checkRecentComments();
  }, CHECK_INTERVAL);
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
    startMonitoring();
    console.log('✅ Instagram Collab Bot is running');
    console.log('   Press Ctrl+C to stop\n');
  } catch (error) {
    console.error('❌ Failed to start bot:', error);
    process.exit(1);
  }
})();
