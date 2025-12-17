-- Migration: Create Secure Upload Functions
-- Description: Creates upload_tokens table and secure functions for CSV upload
-- Date: 2025-12-17

-- ============================================================================
-- STEP 1: Create upload_tokens table
-- ============================================================================

CREATE TABLE IF NOT EXISTS upload_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token TEXT UNIQUE NOT NULL,
    client_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    created_by TEXT,
    last_used_at TIMESTAMPTZ
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_upload_tokens_token ON upload_tokens(token);
CREATE INDEX IF NOT EXISTS idx_upload_tokens_client_id ON upload_tokens(client_id);

-- Enable RLS on upload_tokens
ALTER TABLE upload_tokens ENABLE ROW LEVEL SECURITY;

-- Only authenticated users with client access can view tokens
CREATE POLICY "Users can only view their client's upload tokens"
ON upload_tokens
FOR SELECT
USING (
  client_id IN (
    SELECT DISTINCT e.client_id
    FROM editors e
    WHERE e.user_id = auth.uid()
  )
);

-- ============================================================================
-- STEP 2: Create validate_upload_token function
-- ============================================================================

CREATE OR REPLACE FUNCTION validate_upload_token(input_token TEXT)
RETURNS TABLE (
    is_valid BOOLEAN,
    client_id TEXT,
    message TEXT
) AS $$
DECLARE
    token_record RECORD;
BEGIN
    -- Look up the token
    SELECT ut.client_id, ut.is_active, ut.expires_at
    INTO token_record
    FROM upload_tokens ut
    WHERE ut.token = input_token;

    -- If token doesn't exist
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, NULL::TEXT, 'Invalid token'::TEXT;
        RETURN;
    END IF;

    -- Check if token is active
    IF NOT token_record.is_active THEN
        RETURN QUERY SELECT false, NULL::TEXT, 'Token is inactive'::TEXT;
        RETURN;
    END IF;

    -- Check if token is expired
    IF token_record.expires_at IS NOT NULL AND token_record.expires_at < NOW() THEN
        RETURN QUERY SELECT false, NULL::TEXT, 'Token has expired'::TEXT;
        RETURN;
    END IF;

    -- Token is valid - update last_used_at
    UPDATE upload_tokens
    SET last_used_at = NOW()
    WHERE token = input_token;

    -- Return success
    RETURN QUERY SELECT true, token_record.client_id, 'Token is valid'::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 3: Create replace_client_lots function
-- ============================================================================

CREATE OR REPLACE FUNCTION replace_client_lots(
    client_token TEXT,
    new_lots_data JSONB
)
RETURNS TABLE (
    success BOOLEAN,
    client_id TEXT,
    records_deleted INTEGER,
    records_inserted INTEGER,
    error TEXT
) AS $$
DECLARE
    validated_client_id TEXT;
    is_token_valid BOOLEAN;
    validation_message TEXT;
    deleted_count INTEGER;
    inserted_count INTEGER;
    lot_record JSONB;
BEGIN
    -- Validate the token first
    SELECT vt.is_valid, vt.client_id, vt.message
    INTO is_token_valid, validated_client_id, validation_message
    FROM validate_upload_token(client_token) vt;

    -- If token is invalid, return error
    IF NOT is_token_valid THEN
        RETURN QUERY SELECT false, NULL::TEXT, 0, 0, validation_message;
        RETURN;
    END IF;

    -- Delete all existing lots for this client
    DELETE FROM lots WHERE lots.client_id = validated_client_id;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    -- Insert new lots from the JSON array
    inserted_count := 0;
    FOR lot_record IN SELECT * FROM jsonb_array_elements(new_lots_data)
    LOOP
        INSERT INTO lots (
            id,
            uuid,
            lot_name,
            size,
            rSize,
            price,
            millones,
            availability,
            price_m2,
            nickname,
            subtitle,
            image,
            fraccionamiento,
            client_id
        ) VALUES (
            (lot_record->>'id')::INTEGER,
            (lot_record->>'uuid')::UUID,
            lot_record->>'lot_name',
            lot_record->>'size',
            lot_record->>'rSize',
            (lot_record->>'price')::NUMERIC,
            lot_record->>'millones',
            lot_record->>'availability',
            (lot_record->>'price_m2')::NUMERIC,
            lot_record->>'nickname',
            lot_record->>'subtitle',
            lot_record->>'image',
            lot_record->>'fraccionamiento',
            validated_client_id  -- Use the validated client_id from token
        );
        inserted_count := inserted_count + 1;
    END LOOP;

    -- Return success
    RETURN QUERY SELECT true, validated_client_id, deleted_count, inserted_count, NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE upload_tokens IS 'Stores secure tokens for CSV upload functionality';
COMMENT ON FUNCTION validate_upload_token(TEXT) IS 'Validates an upload token and returns client_id if valid';
COMMENT ON FUNCTION replace_client_lots(TEXT, JSONB) IS 'Securely replaces all lots for a client using token-based authentication';
