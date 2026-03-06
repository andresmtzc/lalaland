-- REVERT: Undo 20260306_allowed_communities_enforcement.sql
-- Restores the exact policies left by 20250124_fix_rls_recursion.sql
-- (single FOR ALL using get_user_client_ids() on both lots and lot_updates_audit).
-- Run this SQL in the Supabase dashboard if the feature needs to be rolled back.
-- Date: 2026-03-06

-- ============================================================================
-- LOTS table — drop split policies, restore original FOR ALL
-- ============================================================================

DROP POLICY IF EXISTS "Editors can read their client's lots" ON lots;
DROP POLICY IF EXISTS "Editors can insert their client's lots" ON lots;
DROP POLICY IF EXISTS "Editors can delete their client's lots" ON lots;
DROP POLICY IF EXISTS "Editors can update their allowed communities' lots" ON lots;

CREATE POLICY "Users can only access their client's lots"
ON lots
FOR ALL
USING (client_id = ANY(get_user_client_ids()));

-- ============================================================================
-- LOT_UPDATES_AUDIT table — drop split policies, restore original FOR ALL
-- ============================================================================

DROP POLICY IF EXISTS "Editors can read their client's audit logs" ON lot_updates_audit;
DROP POLICY IF EXISTS "Editors can insert audit logs for their allowed communities" ON lot_updates_audit;
DROP POLICY IF EXISTS "Editors can update their client's audit logs" ON lot_updates_audit;
DROP POLICY IF EXISTS "Editors can delete their client's audit logs" ON lot_updates_audit;

CREATE POLICY "Users can only access their client's audit logs"
ON lot_updates_audit
FOR ALL
USING (client_id = ANY(get_user_client_ids()));
