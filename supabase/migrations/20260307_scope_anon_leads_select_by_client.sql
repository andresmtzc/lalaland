-- Scope anon SELECT on leads tables by x-client-id header.
-- Leaves INSERT/UPDATE/DELETE as USING(true) so nothing breaks.
-- Prevents cross-client data leaks via direct API calls.

BEGIN;

-- ============================================================
-- leads
-- ============================================================
DROP POLICY IF EXISTS anon_full_access_leads ON leads;

CREATE POLICY anon_select_leads ON leads
  FOR SELECT TO anon
  USING (
    (current_setting('request.headers', true)::json ->> 'x-client-id')::text = ANY(client_id)
  );

CREATE POLICY anon_insert_leads ON leads
  FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY anon_update_leads ON leads
  FOR UPDATE TO anon
  USING (true) WITH CHECK (true);

-- No anon DELETE on leads

-- ============================================================
-- lead_tokens
-- ============================================================
DROP POLICY IF EXISTS anon_all_lead_tokens ON lead_tokens;

CREATE POLICY anon_select_lead_tokens ON lead_tokens
  FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM leads
      WHERE leads.id = lead_tokens.lead_id
        AND (current_setting('request.headers', true)::json ->> 'x-client-id')::text = ANY(leads.client_id)
    )
  );

CREATE POLICY anon_insert_lead_tokens ON lead_tokens
  FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY anon_update_lead_tokens ON lead_tokens
  FOR UPDATE TO anon
  USING (true) WITH CHECK (true);

-- No anon DELETE on lead_tokens

-- ============================================================
-- lead_saved_lots
-- ============================================================
DROP POLICY IF EXISTS anon_full_access_saved_lots ON lead_saved_lots;

CREATE POLICY anon_select_lead_saved_lots ON lead_saved_lots
  FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM leads
      WHERE leads.id = lead_saved_lots.lead_id
        AND (current_setting('request.headers', true)::json ->> 'x-client-id')::text = ANY(leads.client_id)
    )
  );

CREATE POLICY anon_insert_lead_saved_lots ON lead_saved_lots
  FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY anon_delete_lead_saved_lots ON lead_saved_lots
  FOR DELETE TO anon
  USING (true);

-- No anon UPDATE on lead_saved_lots

-- ============================================================
-- lead_sessions
-- ============================================================
DROP POLICY IF EXISTS anon_full_access_sessions ON lead_sessions;

CREATE POLICY anon_select_lead_sessions ON lead_sessions
  FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM leads
      WHERE leads.id = lead_sessions.lead_id
        AND (current_setting('request.headers', true)::json ->> 'x-client-id')::text = ANY(leads.client_id)
    )
  );

CREATE POLICY anon_insert_lead_sessions ON lead_sessions
  FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY anon_update_lead_sessions ON lead_sessions
  FOR UPDATE TO anon
  USING (true) WITH CHECK (true);

-- No anon DELETE on lead_sessions

COMMIT;
