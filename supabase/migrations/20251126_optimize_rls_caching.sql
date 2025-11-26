-- Migration: Optimize RLS Function with Statement-Level Caching
-- Description: Improves performance of get_user_client_ids() function by enabling PostgreSQL query plan caching
-- Date: 2025-11-26
-- Related to: SUPABASE_PERFORMANCE_ANALYSIS.md Fix #2

-- ============================================================================
-- STEP 1: Drop the existing function
-- ============================================================================

DROP FUNCTION IF EXISTS get_user_client_ids();

-- ============================================================================
-- STEP 2: Recreate function with STABLE to allow PostgreSQL to cache within statement
-- ============================================================================

-- STABLE functions with same arguments return same results during a single statement
-- This allows PostgreSQL to cache the result within a query execution, dramatically
-- reducing overhead when RLS policies are checked multiple times (e.g., in realtime subscriptions)
CREATE OR REPLACE FUNCTION get_user_client_ids()
RETURNS TEXT[] AS $$
DECLARE
  client_ids TEXT[];
BEGIN
  -- Use ARRAY_AGG which is more efficient than ARRAY(SELECT ...)
  SELECT ARRAY_AGG(DISTINCT e.client_id)
  INTO client_ids
  FROM editors e
  WHERE e.user_id = auth.uid();

  -- Return empty array instead of NULL for consistency
  RETURN COALESCE(client_ids, ARRAY[]::TEXT[]);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================================================
-- STEP 3: Add composite index to optimize the query
-- ============================================================================

-- This index speeds up the WHERE clause in get_user_client_ids()
-- Covering both user_id and client_id in a single index allows index-only scans
CREATE INDEX IF NOT EXISTS idx_editors_user_id_client_id ON editors(user_id, client_id);

-- ============================================================================
-- STEP 4: Grant execute permission to authenticated users
-- ============================================================================

GRANT EXECUTE ON FUNCTION get_user_client_ids() TO authenticated;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION get_user_client_ids() IS 'Returns array of client_ids user has access to - STABLE allows query plan caching for better performance';
COMMENT ON INDEX idx_editors_user_id_client_id IS 'Composite index for optimized client access checks in RLS policies';

-- ============================================================================
-- PERFORMANCE NOTES
-- ============================================================================

-- Expected improvements after this migration:
-- 1. 50-70% reduction in database CPU usage for RLS policy checks
-- 2. Faster query execution when multiple rows are checked in a single statement
-- 3. Better performance with realtime subscriptions (lots, pins channels)
-- 4. Reduced load when multiple tabs are open simultaneously
--
-- The STABLE keyword tells PostgreSQL that this function:
-- - Does not modify the database
-- - Returns the same result for same arguments within a single statement
-- - Can be optimized by caching results during statement execution
--
-- This is safe because:
-- - auth.uid() is constant within a single request/statement
-- - editors table access is read-only via this function
-- - RLS policies on editors table ensure data isolation is maintained
