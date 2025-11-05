const { default: makeWASocket, useMultiFileAuthState, downloadContentFromMessage } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const { Buffer } = require('buffer');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// ============================================================================
// CONFIGURATION
// ============================================================================

const DEBUG = true;
const RESPONSE_TIMEOUT = 30 * 1000;
const ALERT_NUMBER = '5218112881110@s.whatsapp.net';
const MESSAGE_CONTEXT_COUNT = 5;
const SUPABASE_POLL_INTERVAL = 10000; // 10 seconds

// Supabase client
const supabase = createClient(
  "https://jmoxbhodpvnlmtihcwvt.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imptb3hiaG9kcHZubG10aWhjd3Z0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIxODM1MDgsImV4cCI6MjA2Nzc1OTUwOH0.-jP1akHIo9R4a2lD15byC5dESSGfeFHu8qlbmHteeJo"
);

// ============================================================================
// GLOBAL STATE
// ============================================================================

let sock = null; // Single WhatsApp socket instance
let groupPairs = [];
const messageMap = new Map();
const pendingAlerts = new Map();
const messageHistory = new Map();

// ============================================================================
// FILE OPERATIONS
// ============================================================================

async function loadGroupsFromSupabase() {
    try {
        console.log('📡 Loading groups from Supabase...');
        
        const { data: completedRequests, error } = await supabase
            .from('group_requests')
            .select('*')
            .eq('status', 'completed')
            .not('buyer_group_id', 'is', null)
            .not('seller_group_id', 'is', null);

        if (error) throw error;

        groupPairs = completedRequests.map(req => ({
            buyerGroup: req.buyer_group_id,
            sellerGroup: req.seller_group_id,
            buyerName: req.buyer_name,
            agentName: req.agent_name,
            buyerNumber: req.buyer_number,  // Store from Supabase!
            agentNumber: req.agent_number    // Store from Supabase!
        }));

        console.log(`✅ Loaded ${groupPairs.length} group pairs from Supabase`);
        
        // Also save to JSON as backup
        saveGroups();
        
    } catch (err) {
        console.error('❌ Error loading groups from Supabase:', err);
        console.log('📁 Attempting to load from groups.json backup...');
        
        // Fallback to JSON file
        try {
            if (fs.existsSync('groups.json')) {
                const data = fs.readFileSync('groups.json', 'utf8');
                groupPairs = JSON.parse(data);
                console.log(`📁 Loaded ${groupPairs.length} group pairs from groups.json backup`);
            } else {
                groupPairs = [];
                console.log('📁 No backup found - starting with empty group list');
            }
        } catch (jsonErr) {
            console.error('❌ Error loading groups.json:', jsonErr);
            groupPairs = [];
        }
    }
}

function saveGroups() {
    try {
        fs.writeFileSync('groups.json', JSON.stringify(groupPairs, null, 2));
        console.log(`💾 Saved ${groupPairs.length} group pairs to groups.json`);
    } catch (err) {
        console.error('❌ Error saving groups.json:', err);
    }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

async function streamToBuffer(stream) {
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    return Buffer.concat(chunks);
}

function extractTextFromMsg(msg) {
    const m = msg.message || {};
    return m.conversation
        || m.extendedTextMessage?.text
        || m.imageMessage?.caption
        || m.videoMessage?.caption
        || m.documentMessage?.caption
        || m.buttonsResponseMessage?.selectedDisplayText
        || m.listResponseMessage?.singleSelectReply?.selectedRowId
        || null;
}

function extractCleanPhoneNumber(phoneField) {
    if (!phoneField) return 'Unknown';
    
    // Handle @s.whatsapp.net format
    if (phoneField.includes('@s.whatsapp.net')) {
        const numberPart = phoneField.split('@')[0];
        const cleanNumber = numberPart.replace(/\D/g, '');
        if (cleanNumber.length >= 10) {
            return `+${cleanNumber}`;
        }
        return `+${numberPart}`;
    }
    
    // Handle @lid format - extract phone from the LID
    if (phoneField.includes('@lid')) {
        // LID format is typically: deviceId@lid
        // We need to get the actual phone number from group metadata differently
        return phoneField; // Return as-is, we'll handle it differently
    }
    
    return 'Invalid Format';
}

async function downloadImage(url) {
    try {
        console.log(`📥 Downloading image: ${url}`);
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to download: ${response.statusText}`);
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        console.log(`✅ Image downloaded (${buffer.length} bytes)`);
        return buffer;
    } catch (err) {
        console.error('❌ Error downloading image:', err.message);
        return null;
    }
}

// ============================================================================
// MESSAGE HISTORY FUNCTIONS
// ============================================================================

function addToHistory(conversationId, senderType, text, isMedia = false) {
    if (!messageHistory.has(conversationId)) {
        messageHistory.set(conversationId, []);
    }
    
    const history = messageHistory.get(conversationId);
    const message = {
        sender: senderType,
        text: isMedia ? '[Media]' : text,
        timestamp: new Date()
    };
    
    history.push(message);
    
    if (history.length > 15) {
        history.shift();
    }
    
    if (DEBUG) {
        console.log(`💾 Added to history (${conversationId}): ${senderType} - ${isMedia ? '[Media]' : text}`);
        console.log(`   Total messages in history: ${history.length}`);
    }
}

// ============================================================================
// PARTICIPANT FUNCTIONS
// ============================================================================

// Get agent phone number - just return from the pair data!
function getAgentNumber(pair) {
    if (pair.agentNumber) {
        if (DEBUG) console.log(`✅ Agent number from Supabase: ${pair.agentNumber}`);
        return pair.agentNumber;
    }
    if (DEBUG) console.log(`⚠️ No agent number in pair data`);
    return 'Unknown Agent';
}

// Get buyer phone number - just return from the pair data!
function getBuyerNumber(pair) {
    if (pair.buyerNumber) {
        if (DEBUG) console.log(`✅ Buyer number from Supabase: ${pair.buyerNumber}`);
        return pair.buyerNumber;
    }
    if (DEBUG) console.log(`⚠️ No buyer number in pair data`);
    return 'Unknown Buyer';
}

// ============================================================================
// ALERT FUNCTIONS
// ============================================================================

function formatAlertMessage(buyerNumber, sellerNumber, recentMessages) {
    let alert = `⚠️ *UNRESPONSIVE AGENT ALERT* ⚠️\n\n`;
    alert += `🔴 Agent hasn't responded in ${RESPONSE_TIMEOUT/60000} minutes\n\n`;
    alert += `🏢 *Agent:* ${sellerNumber}\n`;
    alert += `🛒 *Buyer:* ${buyerNumber}\n\n`;
    alert += `📝 *Recent conversation context:*\n`;
    alert += `${'─'.repeat(40)}\n\n`;
    
    if (recentMessages.length === 0) {
        alert += `No recent messages found\n\n`;
    } else {
        recentMessages.forEach((msg, idx) => {
            const timeStr = msg.timestamp.toLocaleString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit',
    month: 'short',
    day: 'numeric',
    timeZone: 'America/Mexico_City'
});
            const sender = msg.sender === 'buyer' ? '🛒 Buyer' : '🏢 Agent';
            alert += `${sender} (${timeStr}):\n"${msg.text}"\n\n`;
        });
    }
    
    alert += `${'─'.repeat(40)}`;
    
    return alert;
}

// ============================================================================
// GROUP CREATION FUNCTIONS
// ============================================================================

async function createGroups(buyerName, buyerNumber, agentName, agentNumber) {
    const buyerJid = buyerNumber.replace(/\D/g, '') + '@s.whatsapp.net';
    const agentJid = agentNumber.replace(/\D/g, '') + '@s.whatsapp.net';
    
    const sellerGroupName = `Agente: ${agentName} | Cliente: ${buyerName}`;
    const buyerGroupName = `Cliente: ${buyerName} | Agente: ${agentName}`;
    
    console.log(`🔄 Creating groups for ${buyerName} ↔ ${agentName}`);
    
    // Download images
    const buyerGroupImage = await downloadImage('https://la-la.land/InvertaCliente.png');
    const sellerGroupImage = await downloadImage('https://la-la.land/InvertaAgente.png');
    
    // Create seller group
    const sellerGroup = await sock.groupCreate(sellerGroupName, [agentJid]);
    if (sellerGroupImage) {
        await sock.updateProfilePicture(sellerGroup.id, sellerGroupImage);
    }
    
    // Wait to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 60000));
    
    // Create buyer group
    const buyerGroup = await sock.groupCreate(buyerGroupName, [buyerJid]);
    if (buyerGroupImage) {
        await sock.updateProfilePicture(buyerGroup.id, buyerGroupImage);
    }
    
    // Add to group pairs and save
    groupPairs.push({
        buyerGroup: buyerGroup.id,
        sellerGroup: sellerGroup.id,
        buyerName,
        agentName,
        buyerNumber,  // Store the numbers!
        agentNumber
    });
    saveGroups();
    
    console.log(`✅ Groups created and added to monitoring list`);
    
    return { buyerGroup, sellerGroup };
}

// ============================================================================
// SUPABASE POLLING
// ============================================================================

async function checkPendingRequests() {
    try {
        const { data: requests, error } = await supabase
            .from('group_requests')
            .select('*')
            .eq('status', 'pending')
            .order('created_at', { ascending: true })
            .limit(1);

        if (error) throw error;

        if (requests && requests.length > 0) {
            await processRequest(requests[0]);
        }
    } catch (err) {
        console.error('Error checking requests:', err);
    }
}

async function processRequest(request) {
    console.log(`🔄 Processing request ${request.id}: ${request.buyer_name} ↔ ${request.agent_name}`);
    
    try {
        // Mark as processing
        await supabase
            .from('group_requests')
            .update({ status: 'processing' })
            .eq('id', request.id);

        // Create groups
        const result = await createGroups(
            request.buyer_name,
            request.buyer_number,
            request.agent_name,
            request.agent_number
        );

        // Mark as completed
        await supabase
            .from('group_requests')
            .update({
                status: 'completed',
                completed_at: new Date(),
                buyer_group_id: result.buyerGroup.id,
                seller_group_id: result.sellerGroup.id
            })
            .eq('id', request.id);

        console.log(`✅ Completed request ${request.id}`);

    } catch (err) {
        console.error(`❌ Error processing request ${request.id}:`, err);
        
        await supabase
            .from('group_requests')
            .update({
                status: 'error',
                error_message: err.message
            })
            .eq('id', request.id);
    }
}

function startPolling() {
    setInterval(checkPendingRequests, SUPABASE_POLL_INTERVAL);
    console.log('🔍 Started polling Supabase for new group requests...');
}

// ============================================================================
// MESSAGE HANDLING
// ============================================================================

function setupMessageHandlers(sock) {
    sock.ev.on('messages.upsert', async (m) => {
        if (!m.messages) return;

        for (let msg of m.messages) {
            if (msg.key.fromMe) continue;

            const groupId = msg.key.remoteJid;
            const pair = groupPairs.find(p => p.buyerGroup === groupId || p.sellerGroup === groupId);
            if (!pair) continue;

            let targetGroup;
            let isSellerMessage = false;
            let isBuyerMessage = false;
            let prefix = '';

            if (groupId === pair.sellerGroup) {
                targetGroup = pair.buyerGroup;
                isSellerMessage = true;
                prefix = '*Agente Inverta*:\n';
            } else {
                targetGroup = pair.sellerGroup;
                isBuyerMessage = true;
            }

            if (DEBUG) {
                console.log('\n📨 NEW MESSAGE RECEIVED:');
                console.log('   Group:', groupId);
                console.log('   Is seller group?', isSellerMessage);
                console.log('   Is buyer group?', isBuyerMessage);
            }

            try {
                if (!msg.message) continue;
                
                // Handle delete messages
                if (msg.message.protocolMessage?.type === 0) {
                    const deletedMsgId = msg.message.protocolMessage.key?.id;
                    if (deletedMsgId) {
                        const mapKey = `${groupId}_${deletedMsgId}`;
                        const forwardedInfo = messageMap.get(mapKey);
                        
                        if (forwardedInfo) {
                            await sock.sendMessage(forwardedInfo.targetGroup, {
                                delete: {
                                    remoteJid: forwardedInfo.targetGroup,
                                    fromMe: true,
                                    id: forwardedInfo.forwardedMsgId
                                }
                            });
                            
                            messageMap.delete(mapKey);
                            
                            if (DEBUG) console.log('✓ Deleted forwarded message');
                        }
                    }
                    continue;
                }
                
                if (msg.message.protocolMessage) continue;

                const extractedText = extractTextFromMsg(msg);
                const msgContent = msg.message;
                let sentMessage = null;

                // AGENT RESPONSE HANDLING
                if (isSellerMessage) {
                    const hasText = !!extractedText;
                    const hasMedia = !!(msgContent.imageMessage || msgContent.videoMessage || msgContent.documentMessage);
                    
                    if (DEBUG) {
                        console.log(`🔔 Agent message detected in ${pair.sellerGroup}`);
                        console.log(`   Has text: ${hasText}, Has media: ${hasMedia}`);
                    }
                    
                    if (hasText) {
                        addToHistory(pair.buyerGroup, 'agent', extractedText);
                    } else if (hasMedia) {
                        addToHistory(pair.buyerGroup, 'agent', '[Media]', true);
                    } else {
                        addToHistory(pair.buyerGroup, 'agent', '[Other Message]');
                    }
                    
                    if (pendingAlerts.has(pair.sellerGroup)) {
                        const alertInfo = pendingAlerts.get(pair.sellerGroup);
                        clearTimeout(alertInfo.timer);
                        pendingAlerts.delete(pair.sellerGroup);
                        
                        console.log(`✅ Timer CANCELLED for ${pair.sellerGroup} - Agent responded`);
                    }
                }

                // BUYER MESSAGE HANDLING
                if (isBuyerMessage && (extractedText || msgContent.imageMessage || msgContent.videoMessage || msgContent.documentMessage)) {
                    if (extractedText) {
                        addToHistory(pair.buyerGroup, 'buyer', extractedText);
                    } else {
                        addToHistory(pair.buyerGroup, 'buyer', '[Media]', true);
                    }
                    
                    if (!pendingAlerts.has(pair.sellerGroup)) {
                        const agentNumber = getAgentNumber(pair);
                        const buyerNumber = getBuyerNumber(pair);
                        
                        if (DEBUG) {
                            console.log(`📞 NUMBERS FROM SUPABASE:`);
                            console.log(`   🏢 Agent: ${agentNumber}`);
                            console.log(`   🛒 Buyer: ${buyerNumber}`);
                        }
                        
                        const timer = setTimeout(async () => {
                            console.log(`🔔 TIMER FIRED for ${pair.sellerGroup}`);
                            
                            const history = messageHistory.get(pair.buyerGroup) || [];
                            const recentMessages = history.slice(-MESSAGE_CONTEXT_COUNT);
                            
                            const alertInfo = pendingAlerts.get(pair.sellerGroup);
                            const storedBuyerNumber = alertInfo?.buyerNumber || 'Unknown';
                            const storedSellerNumber = alertInfo?.sellerNumber || 'Unknown Agent';
                            
                            const alertMsg = formatAlertMessage(storedBuyerNumber, storedSellerNumber, recentMessages);
                            
                            try {
                                await sock.sendMessage(ALERT_NUMBER, { text: alertMsg });
                                console.log(`⚠️ Alert sent for unresponsive agent`);
                            } catch (err) {
                                console.error('Error sending alert:', err);
                            }
                            
                            pendingAlerts.delete(pair.sellerGroup);
                        }, RESPONSE_TIMEOUT);
                        
                        pendingAlerts.set(pair.sellerGroup, {
                            timer,
                            lastBuyerMessageTime: Date.now(),
                            buyerNumber: buyerNumber,
                            sellerNumber: agentNumber
                        });
                        
                        console.log(`⏰ Timer STARTED for ${pair.sellerGroup}`);
                    }
                }

                // Handle text messages
                if (extractedText) {
                    if (isSellerMessage) {
                        sentMessage = await sock.sendMessage(targetGroup, { text: prefix + extractedText });
                    } else {
                        sentMessage = await sock.sendMessage(targetGroup, { text: extractedText });
                    }

                    if (DEBUG) {
                        console.log('--- NEW TEXT ---');
                        console.log('From:', groupId);
                        console.log('Text:', (isSellerMessage ? prefix : '') + extractedText);
                        console.log('-----------------');
                    }

                    if (sentMessage?.key?.id) {
                        const mapKey = `${groupId}_${msg.key.id}`;
                        messageMap.set(mapKey, {
                            targetGroup,
                            forwardedMsgId: sentMessage.key.id,
                            isSellerMessage
                        });
                    }

                    continue;
                }

                // Handle media messages
                if (msgContent.imageMessage) {
                    if (isSellerMessage) {
                        const stream = await downloadContentFromMessage(msgContent.imageMessage, 'image');
                        const buffer = await streamToBuffer(stream);
                        const origCaption = msgContent.imageMessage?.caption || '';
                        await sock.sendMessage(targetGroup, { image: buffer, caption: prefix + origCaption });
                    } else {
                        await sock.relayMessage(targetGroup, msg.message, { messageId: msg.key.id });
                    }
                    continue;
                }

                if (msgContent.videoMessage) {
                    if (isSellerMessage) {
                        const stream = await downloadContentFromMessage(msgContent.videoMessage, 'video');
                        const buffer = await streamToBuffer(stream);
                        const origCaption = msgContent.videoMessage?.caption || '';
                        await sock.sendMessage(targetGroup, { video: buffer, caption: prefix + origCaption });
                    } else {
                        await sock.relayMessage(targetGroup, msg.message, { messageId: msg.key.id });
                    }
                    continue;
                }

                if (msgContent.documentMessage) {
                    if (isSellerMessage) {
                        const stream = await downloadContentFromMessage(msgContent.documentMessage, 'document');
                        const buffer = await streamToBuffer(stream);
                        const fileName = msgContent.documentMessage.fileName || 'file';
                        const origCaption = msgContent.documentMessage?.caption || '';
                        await sock.sendMessage(targetGroup, { document: buffer, fileName, caption: prefix + origCaption });
                    } else {
                        await sock.relayMessage(targetGroup, msg.message, { messageId: msg.key.id });
                    }
                    continue;
                }

                if (msgContent.audioMessage || msgContent.stickerMessage || msgContent.voiceMessage) {
                    if (isSellerMessage) {
                        await sock.sendMessage(targetGroup, { text: prefix.trim() });
                    }
                    await sock.relayMessage(targetGroup, msg.message, { messageId: msg.key.id });
                    continue;
                }

                await sock.relayMessage(targetGroup, msg.message, { messageId: msg.key.id });

            } catch (err) {
                console.error('Error forwarding message:', err);
            }
        }
    });

    // Handle message edits
    sock.ev.on('messages.update', async (updates) => {
        for (let update of updates) {
            if (!update.update?.message?.editedMessage) continue;

            const groupId = update.key.remoteJid;
            const originalMsgId = update.key.id;
            const mapKey = `${groupId}_${originalMsgId}`;

            const forwardedInfo = messageMap.get(mapKey);
            if (!forwardedInfo) continue;

            const pair = groupPairs.find(p => p.buyerGroup === groupId || p.sellerGroup === groupId);
            if (!pair) continue;

            const prefix = forwardedInfo.isSellerMessage ? '*Agente*:\n' : '';

            if (DEBUG) {
                console.log('--- MESSAGE EDITED ---');
                console.log('Original ID:', originalMsgId);
                console.log('----------------------');
            }

            try {
                const editedMessage = update.update.message.editedMessage.message;
                const editedText = extractTextFromMsg({ message: editedMessage });

                if (editedText) {
                    await sock.sendMessage(forwardedInfo.targetGroup, {
                        delete: {
                            remoteJid: forwardedInfo.targetGroup,
                            fromMe: true,
                            id: forwardedInfo.forwardedMsgId
                        }
                    });
                    
                    const newMsg = await sock.sendMessage(forwardedInfo.targetGroup, { 
                        text: prefix + editedText 
                    });
                    
                    if (newMsg?.key?.id) {
                        messageMap.set(mapKey, {
                            targetGroup: forwardedInfo.targetGroup,
                            forwardedMsgId: newMsg.key.id,
                            isSellerMessage: forwardedInfo.isSellerMessage
                        });
                    }
                    
                    if (DEBUG) console.log('✓ Message deleted and resent with edits');
                }

            } catch (err) {
                console.error('Error handling message edit:', err);
            }
        }
    });
}

// ============================================================================
// MAIN BOT INITIALIZATION
// ============================================================================

async function startBot() {
    // Load existing groups from Supabase first
    await loadGroupsFromSupabase();

    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    sock = makeWASocket({ auth: state });
    
    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        if (update.qr) {
            qrcode.generate(update.qr, { small: true });
            console.log('📱 Scan this QR with your WhatsApp account!');
        }
        if (update.connection === 'open') {
            console.log('✅ WhatsApp connected!');
            console.log(`📊 Monitoring ${groupPairs.length} group pairs`);
            console.log('🔍 Starting Supabase polling for new group requests...');
            
            // Start Supabase polling
            startPolling();
        }
        if (update.connection === 'close') {
            console.log('Connection closed. Reconnecting...', update.lastDisconnect?.error);
            setTimeout(() => startBot(), 2000);
        }
    });

    // Setup message handlers
    setupMessageHandlers(sock);
}

// ============================================================================
// START THE BOT
// ============================================================================

startBot();