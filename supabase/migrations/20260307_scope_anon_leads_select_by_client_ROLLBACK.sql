-- Rollback: restore anon ALL USING(true) on all lead tables

BEGIN;

-- leads
DROP POLICY IF EXISTS anon_select_leads ON leads;
DROP POLICY IF EXISTS anon_insert_leads ON leads;
DROP POLICY IF EXISTS anon_update_leads ON leads;
CREATE POLICY anon_full_access_leads ON leads FOR ALL TO anon USING (true) WITH CHECK (true);

-- lead_tokens
DROP POLICY IF EXISTS anon_select_lead_tokens ON lead_tokens;
DROP POLICY IF EXISTS anon_insert_lead_tokens ON lead_tokens;
DROP POLICY IF EXISTS anon_update_lead_tokens ON lead_tokens;
CREATE POLICY anon_all_lead_tokens ON lead_tokens FOR ALL TO anon USING (true) WITH CHECK (true);

-- lead_saved_lots
DROP POLICY IF EXISTS anon_select_lead_saved_lots ON lead_saved_lots;
DROP POLICY IF EXISTS anon_insert_lead_saved_lots ON lead_saved_lots;
DROP POLICY IF EXISTS anon_delete_lead_saved_lots ON lead_saved_lots;
CREATE POLICY anon_full_access_saved_lots ON lead_saved_lots FOR ALL TO anon USING (true) WITH CHECK (true);

-- lead_sessions
DROP POLICY IF EXISTS anon_select_lead_sessions ON lead_sessions;
DROP POLICY IF EXISTS anon_insert_lead_sessions ON lead_sessions;
DROP POLICY IF EXISTS anon_update_lead_sessions ON lead_sessions;
CREATE POLICY anon_full_access_sessions ON lead_sessions FOR ALL TO anon USING (true) WITH CHECK (true);

COMMIT;
