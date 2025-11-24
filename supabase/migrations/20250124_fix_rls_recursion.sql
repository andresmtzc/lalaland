-- Migration: Fix RLS Infinite Recursion
-- Description: Fixes infinite recursion in editors table policy
-- Date: 2025-01-24

-- ============================================================================
-- STEP 1: Create security definer function to get user's client_ids
-- This function bypasses RLS to prevent recursion
-- ============================================================================

CREATE OR REPLACE FUNCTION auth.get_user_client_ids()
RETURNS TEXT[] AS $$
BEGIN
  RETURN ARRAY(
    SELECT DISTINCT e.client_id
    FROM editors e
    WHERE e.user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION auth.get_user_client_ids() TO authenticated;

-- ============================================================================
-- STEP 2: Drop and recreate all RLS policies using the security definer function
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can only access their client's lots" ON lots;
DROP POLICY IF EXISTS "Users can only access their client's pins" ON pins;
DROP POLICY IF EXISTS "Users can only access their client's editors" ON editors;
DROP POLICY IF EXISTS "Users can only access their client's audit logs" ON lot_updates_audit;

-- EDITORS table: Users can see their own editor records
-- This is the key fix - simple policy that doesn't query editors recursively
CREATE POLICY "Users can see their own editor records"
ON editors
FOR SELECT
USING (user_id = auth.uid());

-- LOTS table: Users can only access lots from their assigned client(s)
CREATE POLICY "Users can only access their client's lots"
ON lots
FOR ALL
USING (client_id = ANY(auth.get_user_client_ids()));

-- PINS table: Users can only access pins from their assigned client(s)
CREATE POLICY "Users can only access their client's pins"
ON pins
FOR ALL
USING (client_id = ANY(auth.get_user_client_ids()));

-- LOT_UPDATES_AUDIT table: Users can only see audit logs from their client(s)
CREATE POLICY "Users can only access their client's audit logs"
ON lot_updates_audit
FOR ALL
USING (client_id = ANY(auth.get_user_client_ids()));

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION auth.get_user_client_ids() IS 'Returns array of client_ids user has access to - SECURITY DEFINER bypasses RLS to prevent recursion';
