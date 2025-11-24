-- Migration: Client Isolation Security Fix
-- Description: Implements database-level client isolation to prevent cross-client access
-- Date: 2025-01-24

-- ============================================================================
-- STEP 1: Add user_id to editors table to link users to their allowed clients
-- ============================================================================

-- Add user_id column to editors table (references auth.users)
ALTER TABLE editors
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_editors_user_id ON editors(user_id);
CREATE INDEX IF NOT EXISTS idx_editors_email_client ON editors(email, client_id);

-- ============================================================================
-- STEP 1.5: Add client_id to lot_updates_audit if missing
-- ============================================================================

-- Add client_id column to lot_updates_audit table (if it doesn't exist)
ALTER TABLE lot_updates_audit
ADD COLUMN IF NOT EXISTS client_id TEXT;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_lot_updates_audit_client_id ON lot_updates_audit(client_id);

-- Backfill client_id from lots table using lot_name
UPDATE lot_updates_audit lua
SET client_id = l.client_id
FROM lots l
WHERE lua.lot_name = l.lot_name
AND lua.client_id IS NULL;

-- ============================================================================
-- STEP 2: Create helper function to get user's allowed client_id
-- ============================================================================

-- Function to get the client_id(s) a user is authorized for
CREATE OR REPLACE FUNCTION get_user_client_ids(user_id UUID)
RETURNS TABLE (client_id TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT e.client_id
  FROM editors e
  WHERE e.user_id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 3: Enable Row Level Security (RLS) on all tables
-- ============================================================================

ALTER TABLE lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE pins ENABLE ROW LEVEL SECURITY;
ALTER TABLE editors ENABLE ROW LEVEL SECURITY;
ALTER TABLE lot_updates_audit ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 4: Create RLS Policies for client isolation
-- ============================================================================

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can only access their client's lots" ON lots;
DROP POLICY IF EXISTS "Users can only access their client's pins" ON pins;
DROP POLICY IF EXISTS "Users can only access their client's editors" ON editors;
DROP POLICY IF EXISTS "Users can only access their client's audit logs" ON lot_updates_audit;

-- LOTS table: Users can only access lots from their assigned client(s)
CREATE POLICY "Users can only access their client's lots"
ON lots
FOR ALL
USING (
  client_id IN (
    SELECT DISTINCT e.client_id
    FROM editors e
    WHERE e.user_id = auth.uid()
  )
);

-- PINS table: Users can only access pins from their assigned client(s)
CREATE POLICY "Users can only access their client's pins"
ON pins
FOR ALL
USING (
  client_id IN (
    SELECT DISTINCT e.client_id
    FROM editors e
    WHERE e.user_id = auth.uid()
  )
);

-- EDITORS table: Users can only see editors from their assigned client(s)
CREATE POLICY "Users can only access their client's editors"
ON editors
FOR SELECT
USING (
  client_id IN (
    SELECT DISTINCT e.client_id
    FROM editors e
    WHERE e.user_id = auth.uid()
  )
);

-- LOT_UPDATES_AUDIT table: Users can only see audit logs from their client(s)
CREATE POLICY "Users can only access their client's audit logs"
ON lot_updates_audit
FOR ALL
USING (
  client_id IN (
    SELECT DISTINCT e.client_id
    FROM editors e
    WHERE e.user_id = auth.uid()
  )
);

-- ============================================================================
-- STEP 5: Create function to validate user has access to a specific client
-- ============================================================================

-- Function to check if a user has access to a specific client
CREATE OR REPLACE FUNCTION user_has_client_access(user_id UUID, requested_client_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM editors
    WHERE editors.user_id = user_id
    AND editors.client_id = requested_client_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 6: Add trigger to automatically link user_id when a user signs up
-- ============================================================================

-- Function to link user_id in editors table after OTP verification
CREATE OR REPLACE FUNCTION link_user_to_editor()
RETURNS TRIGGER AS $$
BEGIN
  -- Update editors table to link the user_id based on email
  UPDATE editors
  SET user_id = NEW.id
  WHERE email = NEW.email
  AND user_id IS NULL;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users table (if not exists)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION link_user_to_editor();

-- ============================================================================
-- STEP 7: Backfill existing users (link existing auth users to editors)
-- ============================================================================

-- Update existing editors to link user_id based on email match
UPDATE editors e
SET user_id = u.id
FROM auth.users u
WHERE e.email = u.email
AND e.user_id IS NULL;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON COLUMN editors.user_id IS 'Links editor to auth.users - enforces client isolation';
COMMENT ON FUNCTION get_user_client_ids(UUID) IS 'Returns all client_ids a user has access to';
COMMENT ON FUNCTION user_has_client_access(UUID, TEXT) IS 'Validates if user has access to specific client';
COMMENT ON FUNCTION link_user_to_editor() IS 'Automatically links new users to their editor entry based on email';
