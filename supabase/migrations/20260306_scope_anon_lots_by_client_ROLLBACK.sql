-- ROLLBACK for 20260306_scope_anon_lots_by_client.sql
-- Run this if the scoped policy breaks anything

DROP POLICY IF EXISTS "Allow public read access to lots" ON lots;

CREATE POLICY "Allow public read access to lots"
ON lots
FOR SELECT
USING (true);

COMMENT ON POLICY "Allow public read access to lots" ON lots
  IS 'Allows anonymous users to view lots data - client filtering handled by application layer';
