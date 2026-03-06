-- Migration: Enforce allowed_communities on lot edits
-- Description: Splits the lots and lot_updates_audit RLS policies so that
--   SELECT remains unrestricted (editors can browse all their client's lots),
--   but UPDATE/INSERT are gated by allowed_communities.
--   NULL allowed_communities = full access (existing behaviour for admins).
-- Date: 2026-03-06

-- ============================================================================
-- LOTS table
-- ============================================================================

-- Drop the current FOR ALL policy
DROP POLICY IF EXISTS "Users can only access their client's lots" ON lots;

-- SELECT: unchanged — editors can read all lots from their client
CREATE POLICY "Editors can read their client's lots"
ON lots FOR SELECT
USING (
  client_id IN (
    SELECT DISTINCT e.client_id FROM editors e WHERE e.user_id = auth.uid()
  )
);

-- INSERT: same client-level check as before
CREATE POLICY "Editors can insert their client's lots"
ON lots FOR INSERT
WITH CHECK (
  client_id IN (
    SELECT DISTINCT e.client_id FROM editors e WHERE e.user_id = auth.uid()
  )
);

-- DELETE: same client-level check as before
CREATE POLICY "Editors can delete their client's lots"
ON lots FOR DELETE
USING (
  client_id IN (
    SELECT DISTINCT e.client_id FROM editors e WHERE e.user_id = auth.uid()
  )
);

-- UPDATE: also check allowed_communities
--   NULL allowed_communities → no restriction (full access)
--   non-NULL → fraccionamiento must be in the array
CREATE POLICY "Editors can update their allowed communities' lots"
ON lots FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM editors e
    WHERE e.user_id = auth.uid()
      AND e.client_id = lots.client_id
      AND (
        e.allowed_communities IS NULL
        OR lots.fraccionamiento = ANY(e.allowed_communities)
      )
  )
);

-- ============================================================================
-- LOT_UPDATES_AUDIT table
-- ============================================================================

-- Drop the current FOR ALL policy
DROP POLICY IF EXISTS "Users can only access their client's audit logs" ON lot_updates_audit;

-- SELECT: unchanged — editors can read all audit logs from their client
CREATE POLICY "Editors can read their client's audit logs"
ON lot_updates_audit FOR SELECT
USING (
  client_id IN (
    SELECT DISTINCT e.client_id FROM editors e WHERE e.user_id = auth.uid()
  )
);

-- INSERT: gated by allowed_communities (mirrors the UPDATE policy on lots)
CREATE POLICY "Editors can insert audit logs for their allowed communities"
ON lot_updates_audit FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM editors e
    WHERE e.user_id = auth.uid()
      AND e.client_id = lot_updates_audit.client_id
      AND (
        e.allowed_communities IS NULL
        OR lot_updates_audit.fraccionamiento = ANY(e.allowed_communities)
      )
  )
);

-- UPDATE/DELETE on audit rows: keep same client-level restriction as before
CREATE POLICY "Editors can update their client's audit logs"
ON lot_updates_audit FOR UPDATE
USING (
  client_id IN (
    SELECT DISTINCT e.client_id FROM editors e WHERE e.user_id = auth.uid()
  )
);

CREATE POLICY "Editors can delete their client's audit logs"
ON lot_updates_audit FOR DELETE
USING (
  client_id IN (
    SELECT DISTINCT e.client_id FROM editors e WHERE e.user_id = auth.uid()
  )
);
