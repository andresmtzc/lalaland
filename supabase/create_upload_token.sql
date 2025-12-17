-- Helper script to create upload tokens
-- Usage: Run this in Supabase SQL Editor, replacing 'your-client-id' and 'your-secure-token'

-- Example: Create a token for client 'tx'
INSERT INTO upload_tokens (token, client_id, created_by, expires_at)
VALUES (
    'tx-secure-token-' || gen_random_uuid()::TEXT,  -- Generate a unique secure token
    'tx',                                           -- Your client ID
    'admin',                                        -- Who created it
    NOW() + INTERVAL '1 year'                      -- Expires in 1 year
)
RETURNING token, client_id, expires_at;

-- To create a token that never expires:
-- INSERT INTO upload_tokens (token, client_id, created_by, expires_at)
-- VALUES (
--     'my-permanent-token-123',
--     'tx',
--     'admin',
--     NULL  -- NULL means never expires
-- )
-- RETURNING token, client_id;
