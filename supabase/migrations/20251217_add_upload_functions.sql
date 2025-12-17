-- Migration: Add Upload Functions for Existing client_upload_tokens Table
-- Description: Creates validate_upload_token and replace_client_lots functions
-- Date: 2025-12-17

-- ============================================================================
-- STEP 1: Create validate_upload_token function
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
    -- Look up the token in client_upload_tokens table
    SELECT cut.client_id
    INTO token_record
    FROM client_upload_tokens cut
    WHERE cut.token = input_token;

    -- If token doesn't exist
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, NULL::TEXT, 'Invalid token'::TEXT;
        RETURN;
    END IF;

    -- Token is valid - return success
    RETURN QUERY SELECT true, token_record.client_id, 'Token is valid'::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 2: Create replace_client_lots function
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
            CASE WHEN lot_record->>'id' IS NOT NULL AND lot_record->>'id' != ''
                 THEN (lot_record->>'id')::INTEGER
                 ELSE NULL
            END,
            CASE WHEN lot_record->>'uuid' IS NOT NULL AND lot_record->>'uuid' != ''
                 THEN (lot_record->>'uuid')::UUID
                 ELSE gen_random_uuid()
            END,
            lot_record->>'lot_name',
            lot_record->>'size',
            lot_record->>'rSize',
            CASE WHEN lot_record->>'price' IS NOT NULL AND lot_record->>'price' != ''
                 THEN (lot_record->>'price')::NUMERIC
                 ELSE NULL
            END,
            lot_record->>'millones',
            lot_record->>'availability',
            CASE WHEN lot_record->>'price_m2' IS NOT NULL AND lot_record->>'price_m2' != ''
                 THEN (lot_record->>'price_m2')::NUMERIC
                 ELSE NULL
            END,
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

EXCEPTION
    WHEN OTHERS THEN
        -- Catch any errors and return them
        RETURN QUERY SELECT false, validated_client_id, deleted_count, inserted_count, SQLERRM::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION validate_upload_token(TEXT) IS 'Validates an upload token from client_upload_tokens table and returns client_id if valid';
COMMENT ON FUNCTION replace_client_lots(TEXT, JSONB) IS 'Securely replaces all lots for a client using token-based authentication';
