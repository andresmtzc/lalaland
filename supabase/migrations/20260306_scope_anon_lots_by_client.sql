-- Migration: Scope anonymous lots read access by client_id header
-- Description: Replaces the wide-open USING(true) anon SELECT policy with one
--              that requires x-client-id header to match the row's client_id.
--              Frontend must send: global.headers['x-client-id'] = CURRENT_CLIENT
-- Date: 2026-03-06
--
-- ROLLBACK: See 20260306_scope_anon_lots_by_client_ROLLBACK.sql

-- 1. Drop the wide-open anon policy
DROP POLICY IF EXISTS "Allow public read access to lots" ON lots;

-- 2. Fix the authenticated policy: it was missing TO clause (defaulted to PUBLIC,
--    meaning anon could also use it to bypass client scoping)
DROP POLICY IF EXISTS "Users can only access their client's lots" ON lots;

CREATE POLICY "Users can only access their client's lots"
ON lots
FOR ALL
TO authenticated
USING (client_id = ANY(get_user_client_ids()));

-- 3. Create scoped anon policy via request header
CREATE POLICY "Allow public read access to lots"
ON lots
FOR SELECT
TO anon
USING (
  client_id = current_setting('request.headers', true)::json->>'x-client-id'
);

COMMENT ON POLICY "Allow public read access to lots" ON lots
  IS 'Anon users can only read lots matching x-client-id request header';
