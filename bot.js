const { default: makeWASocket, useMultiFileAuthState, downloadContentFromMessage, DisconnectReason, fetchLatestBaileysVersion, Browsers } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const { Buffer } = require('buffer');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// ============================================================================
// CONFIGURATION
// ============================================================================

const DEBUG = true;
const RESPONSE_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours
const ALERT_NUMBER = '5212291703721@s.whatsapp.net';
const MESSAGE_CONTEXT_COUNT = 5;
const SUPABASE_POLL_INTERVAL = 10000; // 10 seconds
const LINK_POLL_INTERVAL = 3000; // 3 seconds for faster link delivery
const MAX_LINKS_PER_MINUTE = 3; // Global rate limit (conservative to avoid WhatsApp spam detection)
const AGENT_ASSIGNMENT_POLL_INTERVAL = 15000; // 15 seconds
const ASSIGNMENT_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

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
const MESSAGE_MAP_MAX = 1000; // Max tracked messages to avoid unbounded growth
const pendingAlerts = new Map();
const messageHistory = new Map();
const linksSentTimestamps = []; // Track timestamps for global rate limiting

// Polling interval handles (cleared on each reconnect to prevent accumulation)
let supabasePollingInterval = null;
let linkPollingInterval = null;
let agentAssignmentInterval = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_DELAY = 60000; // 60 seconds cap

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
            buyerNumber: req.buyer_number,
            agentNumber: req.agent_number
        }));

        console.log(`✅ Loaded ${groupPairs.length} group pairs from Supabase`);

        // Also save to JSON as backup
        saveGroups();

    } catch (err) {
        console.error('❌ Error loading groups from Supabase:', err);
        console.log('📁 Attempting to load from groups.json backup...');

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

    if (phoneField.includes('@s.whatsapp.net')) {
        const numberPart = phoneField.split('@')[0];
        const cleanNumber = numberPart.replace(/\D/g, '');
        if (cleanNumber.length >= 10) {
            return `+${cleanNumber}`;
        }
        return `+${numberPart}`;
    }

    if (phoneField.includes('@lid')) {
        return phoneField;
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

function getAgentNumber(pair) {
    if (pair.agentNumber) {
        if (DEBUG) console.log(`✅ Agent number from Supabase: ${pair.agentNumber}`);
        return pair.agentNumber;
    }
    if (DEBUG) console.log(`⚠️ No agent number in pair data`);
    return 'Unknown Agent';
}

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
    alert += `🔴 Agent hasn't responded in ${RESPONSE_TIMEOUT / 3600000} hours\n\n`;
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
// GROUP CREATION FUNCTIONS (WITH RATE-LIMIT ERROR RECOVERY)
// ============================================================================

async function createGroups(buyerName, buyerNumber, agentName, agentNumber) {
    const buyerJid = buyerNumber.replace(/\D/g, '') + '@s.whatsapp.net';
    const agentJid = agentNumber.replace(/\D/g, '') + '@s.whatsapp.net';

    const sellerGroupName = `Agente: ${agentName} | Cliente: ${buyerName}`;
    const buyerGroupName = `Cliente: ${buyerName} | Agente: ${agentName}`;

    console.log(`🔄 Creating groups for ${buyerName} ↔ ${agentName}`);

    // Download images first (before any WhatsApp calls)
    const buyerGroupImage = await downloadImage('https://la-la.land/InvertaCliente.png');
    const sellerGroupImage = await downloadImage('https://la-la.land/InvertaAgente.png');

    let sellerGroup, buyerGroup;

    // ========================================
    // CREATE SELLER GROUP (with error recovery)
    // ========================================
    console.log('📱 Creating seller group...');
    try {
        sellerGroup = await sock.groupCreate(sellerGroupName, [agentJid]);
    } catch (err) {
        if (err.message?.includes('rate-overlimit')) {
            console.log('⚠️ Got rate-overlimit error, checking if group was created anyway...');
            await new Promise(resolve => setTimeout(resolve, 5000));

            // Check recent groups to find if it was actually created
            const groups = await sock.groupFetchAllParticipating();
            const found = Object.values(groups).find(g => g.subject === sellerGroupName);

            if (found) {
                console.log('✅ Seller group was actually created despite error!');
                sellerGroup = { id: found.id };
            } else {
                throw err; // Actually failed
            }
        } else {
            throw err;
        }
    }

    console.log('✅ Seller group created:', sellerGroup.id);

    // Set seller group image
    if (sellerGroupImage) {
        try {
            await new Promise(resolve => setTimeout(resolve, 3000));
            await sock.updateProfilePicture(sellerGroup.id, sellerGroupImage);
            console.log('🖼️ Seller group image set');
        } catch (err) {
            console.log('⚠️ Could not set seller group image:', err.message);
        }
    }

    // Wait between group creations
    console.log('⏳ Waiting 60 seconds before creating buyer group...');
    await new Promise(resolve => setTimeout(resolve, 60000));

    // ========================================
    // CREATE BUYER GROUP (with error recovery)
    // ========================================
    console.log('📱 Creating buyer group...');
    try {
        buyerGroup = await sock.groupCreate(buyerGroupName, [buyerJid]);
    } catch (err) {
        if (err.message?.includes('rate-overlimit')) {
            console.log('⚠️ Got rate-overlimit error, checking if group was created anyway...');
            await new Promise(resolve => setTimeout(resolve, 5000));

            const groups = await sock.groupFetchAllParticipating();
            const found = Object.values(groups).find(g => g.subject === buyerGroupName);

            if (found) {
                console.log('✅ Buyer group was actually created despite error!');
                buyerGroup = { id: found.id };
            } else {
                throw err; // Actually failed
            }
        } else {
            throw err;
        }
    }

    console.log('✅ Buyer group created:', buyerGroup.id);

    // Set buyer group image
    if (buyerGroupImage) {
        try {
            await new Promise(resolve => setTimeout(resolve, 3000));
            await sock.updateProfilePicture(buyerGroup.id, buyerGroupImage);
            console.log('🖼️ Buyer group image set');
        } catch (err) {
            console.log('⚠️ Could not set buyer group image:', err.message);
        }
    }

    // Add to group pairs and save
    groupPairs.push({
        buyerGroup: buyerGroup.id,
        sellerGroup: sellerGroup.id,
        buyerName,
        agentName,
        buyerNumber,
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
                completed_at: new Date().toISOString(),
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

// ============================================================================
// AGENT ASSIGNMENT POLLING
// ============================================================================

async function checkAgentAssignments() {
    try {
        const { data: leads, error } = await supabase
            .from('leads')
            .select('id, name, last_name, phone, assigned_agent, agent_assigned_at, agent_accepted_at, agent_notified_at, assigned_by')
            .not('agent_assigned_at', 'is', null);

        if (error || !leads || leads.length === 0) return;

        for (const lead of leads) {
            const assignedAgent = typeof lead.assigned_agent === 'string' ? JSON.parse(lead.assigned_agent) : (lead.assigned_agent || {});
            const assignedAt = lead.agent_assigned_at || {};
            const acceptedAt = lead.agent_accepted_at || {};
            const notifiedAt = lead.agent_notified_at || {};

            for (const client of Object.keys(assignedAt)) {
                if (acceptedAt[client]) continue;
                const agentPhone = typeof assignedAgent === 'object' ? assignedAgent[client] : null;
                if (!agentPhone) continue;

                const assignedTime = new Date(assignedAt[client]);
                const isAccepted = !!acceptedAt[client];
                const isNotified = !!notifiedAt[client];
                const isExpired = !isAccepted && (Date.now() - assignedTime.getTime() > ASSIGNMENT_TIMEOUT_MS);

                if (!isNotified && !isExpired) {
                    // Notify agent via WhatsApp
                    try {
                        const digits = agentPhone.replace(/\D/g, '');
                        const jid = (digits.length === 10 ? `521${digits}` : digits) + '@s.whatsapp.net';
                        const aceptUrl = `https://la-la.land/${client}/accept.html?agent=${encodeURIComponent(agentPhone)}&client=${client}`;
                        await sock.sendMessage(jid, { text: `Nuevo lead asignado, acéptalo: ${aceptUrl}` });

                        const newNotifiedAt = { ...notifiedAt, [client]: new Date().toISOString() };
                        await supabase.from('leads').update({ agent_notified_at: newNotifiedAt }).eq('id', lead.id);

                        console.log(`📢 Agent ${agentPhone} notified for lead ${lead.id} (${client})`);
                    } catch (err) {
                        console.error(`Error notifying agent ${agentPhone}:`, err.message);
                    }
                } else if (isExpired) {
                    // Revert assignment
                    try {
                        const newAssignedAgent = { ...assignedAgent };
                        const newAssignedAt = { ...assignedAt };
                        const newNotifiedAt = { ...notifiedAt };
                        delete newAssignedAgent[client];
                        delete newAssignedAt[client];
                        delete newNotifiedAt[client];

                        const updateObj = {
                            assigned_agent: Object.keys(newAssignedAgent).length > 0 ? newAssignedAgent : null,
                            agent_assigned_at: Object.keys(newAssignedAt).length > 0 ? newAssignedAt : null,
                            agent_notified_at: Object.keys(newNotifiedAt).length > 0 ? newNotifiedAt : null,
                        };

                        await supabase.from('leads').update(updateObj).eq('id', lead.id);

                        // Notify the admin who assigned this lead
                        const assignedBy = lead.assigned_by || {};
                        const adminPhone = typeof assignedBy === 'object' ? assignedBy[client] : null;
                        if (adminPhone) {
                            const leadName = `${lead.name || ''} ${lead.last_name || ''}`.trim() || lead.phone;
                            const adminJid = adminPhone + '@s.whatsapp.net';
                            await sock.sendMessage(adminJid, {
                                text: `${client.toUpperCase()} - Lead sin aceptar: ${leadName} no fue aceptado por el agente ${agentPhone} en 30 min. Asignación revertida.`
                            });
                        } else {
                            console.warn(`⚠️ No assigned_by phone for lead ${lead.id} (${client}), expiry notification skipped.`);
                        }

                        console.log(`⏰ Assignment expired for lead ${lead.id} (${client})`);
                    } catch (err) {
                        console.error(`Error reverting assignment for lead ${lead.id}:`, err.message);
                    }
                }
            }
        }
    } catch (err) {
        console.error('Error in checkAgentAssignments:', err);
    }
}

function startPolling() {
    if (supabasePollingInterval) {
        clearInterval(supabasePollingInterval);
        supabasePollingInterval = null;
    }
    supabasePollingInterval = setInterval(checkPendingRequests, SUPABASE_POLL_INTERVAL);
    console.log('🔍 Started polling Supabase for new group requests...');
}

// ============================================================================
// LINK REQUEST POLLING (for registro.html WhatsApp link delivery)
// ============================================================================

async function checkPendingLinkRequests() {
    try {
        const { data: requests, error } = await supabase
            .from('link_requests')
            .select('*')
            .eq('status', 'pending')
            .order('created_at', { ascending: true })
            .limit(1);

        if (error) throw error;

        if (requests && requests.length > 0) {
            await processLinkRequest(requests[0]);
        }
    } catch (err) {
        console.error('Error checking link requests:', err);
    }
}

async function processLinkRequest(request) {
    console.log(`📨 Processing link request ${request.id} for ${request.phone}`);

    try {
        // Global rate limit check (max N per minute)
        const oneMinuteAgo = Date.now() - 60000;
        const recentLinks = linksSentTimestamps.filter(t => t > oneMinuteAgo);
        if (recentLinks.length >= MAX_LINKS_PER_MINUTE) {
            console.log(`⚠️ Global rate limit reached (${MAX_LINKS_PER_MINUTE}/min), delaying...`);
            return; // Will retry on next poll
        }

        // ATOMIC CLAIM: Only update if status is still 'pending' (prevents race conditions)
        const { data: claimed, error: claimError } = await supabase
            .from('link_requests')
            .update({ status: 'processing' })
            .eq('id', request.id)
            .eq('status', 'pending')
            .select();

        // If no rows updated, another process already claimed this request
        if (claimError) {
            console.log(`❌ Claim error for ${request.id}:`, claimError);
            return;
        }
        if (!claimed || claimed.length === 0) {
            console.log(`⚠️ Request ${request.id} - update returned empty. Status in DB might not be 'pending' or RLS blocking UPDATE`);
            return;
        }

        console.log(`✅ Claimed request ${request.id}`)

        // Build the confirmation link (opens confirm.html in WhatsApp, activates session in original tab)
        const mapLink = `https://la-la.land/${request.client}/confirm.html?token=${request.token}${request.browser_id ? `&browser=${request.browser_id}` : ''}`;

        // Build WhatsApp message — just the link so they can copy-paste if needed
        const message = mapLink;

        // Send WhatsApp message
        const jid = request.phone + '@s.whatsapp.net';

        await sock.sendMessage(jid, { text: message });

        console.log(`✅ Link sent to ${request.phone}`);

        // Notify the client's advisor about the new lead (skip if already notified for this phone+client)
        try {
            const { data: alreadyNotified } = await supabase
                .from('link_requests')
                .select('id')
                .eq('phone', request.phone)
                .eq('client', request.client)
                .eq('client_notified', true)
                .limit(1);

            if (!alreadyNotified || alreadyNotified.length === 0) {
                const { data: notifyRow } = await supabase
                    .from('client_notify_numbers')
                    .select('phone')
                    .eq('client', request.client)
                    .single();

                if (notifyRow && notifyRow.phone) {
                    await new Promise(resolve => setTimeout(resolve, 3000));
                    const notifyJid = notifyRow.phone + '@s.whatsapp.net';
                    const notifyMsg = `Nuevo lead registrado.\nWhatsApp: +${request.phone}`;
                    await sock.sendMessage(notifyJid, { text: notifyMsg });
                    console.log(`📢 Notified ${request.client} advisor at ${notifyRow.phone}`);
                }

                await supabase
                    .from('link_requests')
                    .update({ client_notified: true })
                    .eq('id', request.id);
            } else {
                console.log(`⏭️ Skipped client notification for ${request.phone} (already notified)`);
            }
        } catch (notifyErr) {
            console.error(`⚠️ Failed to notify ${request.client} advisor:`, notifyErr.message);
        }

        // Track for global rate limiting
        linksSentTimestamps.push(Date.now());
        // Clean up old timestamps (older than 1 minute)
        while (linksSentTimestamps.length > 0 && linksSentTimestamps[0] < Date.now() - 60000) {
            linksSentTimestamps.shift();
        }

        // Mark as completed
        await supabase
            .from('link_requests')
            .update({
                status: 'completed',
                completed_at: new Date().toISOString()
            })
            .eq('id', request.id);

    } catch (err) {
        console.error(`❌ Error processing link request ${request.id}:`, err);

        await supabase
            .from('link_requests')
            .update({
                status: 'error',
                error_message: err.message || 'Error al enviar mensaje'
            })
            .eq('id', request.id);
    }
}

function startLinkPolling() {
    if (linkPollingInterval) {
        clearInterval(linkPollingInterval);
        linkPollingInterval = null;
    }
    linkPollingInterval = setInterval(checkPendingLinkRequests, LINK_POLL_INTERVAL);
    console.log('📨 Started polling Supabase for link requests...');

    if (agentAssignmentInterval) {
        clearInterval(agentAssignmentInterval);
        agentAssignmentInterval = null;
    }
    agentAssignmentInterval = setInterval(checkAgentAssignments, AGENT_ASSIGNMENT_POLL_INTERVAL);
    console.log('👤 Started polling for agent assignments...');
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
                        // Prune oldest entries if map grows too large
                        if (messageMap.size > MESSAGE_MAP_MAX) {
                            const firstKey = messageMap.keys().next().value;
                            messageMap.delete(firstKey);
                        }
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
    const { version } = await fetchLatestBaileysVersion();
    sock = makeWASocket({ auth: state, version, browser: Browsers.macOS('Chrome') });

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
            reconnectAttempts = 0; // Reset backoff on successful connection

            // Start Supabase polling
            startPolling();
            startLinkPolling();
        }
        if (update.connection === 'close') {
            const statusCode = update.lastDisconnect?.error?.output?.statusCode;
            if (statusCode === DisconnectReason.loggedOut) {
                console.log('❌ Logged out by WhatsApp. Delete your auth folder and restart to re-scan the QR code.');
                return;
            }
            console.log('Connection closed. Reconnecting...', update.lastDisconnect?.error);
            reconnectAttempts++;
            const delay = Math.min(2000 * Math.pow(2, reconnectAttempts - 1), MAX_RECONNECT_DELAY);
            console.log(`⏳ Reconnect attempt ${reconnectAttempts}, waiting ${delay / 1000}s...`);
            setTimeout(() => startBot(), delay);
        }
    });

    // Setup message handlers
    setupMessageHandlers(sock);
}

// ============================================================================
// START THE BOT
// ============================================================================

startBot();