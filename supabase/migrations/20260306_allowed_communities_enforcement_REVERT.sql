-- REVERT: Undo 20260306_allowed_communities_enforcement.sql
-- Restores the original single FOR ALL policy per table (no community-level gating on writes).
-- Run this if you need to roll back the allowed_communities enforcement.
-- Date: 2026-03-06

-- ============================================================================
-- LOTS table — drop split policies, restore original FOR ALL
-- ============================================================================

DROP POLICY IF EXISTS "Editors can read their client's lots" ON lots;
DROP POLICY IF EXISTS "Editors can insert their client's lots" ON lots;
DROP POLICY IF EXISTS "Editors can delete their client's lots" ON lots;
DROP POLICY IF EXISTS "Editors can update their allowed communities' lots" ON lots;

CREATE POLICY "Users can only access their client's lots"
ON lots FOR ALL
USING (
  client_id IN (
    SELECT DISTINCT e.client_id FROM editors e WHERE e.user_id = auth.uid()
  )
);

-- ============================================================================
-- LOT_UPDATES_AUDIT table — drop split policies, restore original FOR ALL
-- ============================================================================

DROP POLICY IF EXISTS "Editors can read their client's audit logs" ON lot_updates_audit;
DROP POLICY IF EXISTS "Editors can insert audit logs for their allowed communities" ON lot_updates_audit;
DROP POLICY IF EXISTS "Editors can update their client's audit logs" ON lot_updates_audit;
DROP POLICY IF EXISTS "Editors can delete their client's audit logs" ON lot_updates_audit;

CREATE POLICY "Users can only access their client's audit logs"
ON lot_updates_audit FOR ALL
USING (
  client_id IN (
    SELECT DISTINCT e.client_id FROM editors e WHERE e.user_id = auth.uid()
  )
);
