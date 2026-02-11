-- Convert leads.client_id from TEXT to TEXT[] to support multi-product leads
-- A lead who registers in both agora and cpi will have client_id = ['agora','cpi']

-- 1. Drop ALL policies on all 4 lead tables.
--    Any policy that references leads.client_id (even via JOIN) blocks ALTER COLUMN.
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'leads' AND schemaname = 'public')
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.leads';
    END LOOP;

    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'lead_tokens' AND schemaname = 'public')
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.lead_tokens';
    END LOOP;

    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'lead_saved_lots' AND schemaname = 'public')
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.lead_saved_lots';
    END LOOP;

    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'lead_sessions' AND schemaname = 'public')
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.lead_sessions';
    END LOOP;
END $$;

-- 2. Convert column type (wraps existing single values into arrays)
ALTER TABLE public.leads
  ALTER COLUMN client_id TYPE TEXT[]
  USING CASE WHEN client_id IS NULL THEN NULL ELSE ARRAY[client_id] END;

-- 3. Replace btree index with GIN (supports array operators like @>)
DROP INDEX IF EXISTS idx_leads_client_id;
CREATE INDEX idx_leads_client_ids ON public.leads USING GIN(client_id);

-- 4. Recreate ALL 11 policies (updated for array column where needed)

-- ── leads (4 policies) ──────────────────────────────────────────────

CREATE POLICY anon_full_access_leads
    ON public.leads FOR ALL TO anon
    USING (true) WITH CHECK (true);

CREATE POLICY auth_insert_leads
    ON public.leads FOR INSERT TO authenticated
    WITH CHECK (true);

CREATE POLICY auth_update_leads
    ON public.leads FOR UPDATE TO authenticated
    USING (true) WITH CHECK (true);

CREATE POLICY editors_read_own_client_leads
    ON public.leads FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.editors
            WHERE editors.user_id = auth.uid()
            AND editors.client_id = ANY(leads.client_id)
        )
    );

-- ── lead_tokens (3 policies) ────────────────────────────────────────

CREATE POLICY anon_all_lead_tokens
    ON public.lead_tokens FOR ALL TO anon
    USING (true) WITH CHECK (true);

CREATE POLICY auth_insert_lead_tokens
    ON public.lead_tokens FOR INSERT TO authenticated
    WITH CHECK (true);

CREATE POLICY auth_read_lead_tokens
    ON public.lead_tokens FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.leads
            JOIN public.editors ON editors.client_id = ANY(leads.client_id)
            WHERE leads.id = lead_tokens.lead_id
            AND editors.user_id = auth.uid()
        )
    );

-- ── lead_saved_lots (2 policies) ────────────────────────────────────

CREATE POLICY anon_full_access_saved_lots
    ON public.lead_saved_lots FOR ALL TO anon
    USING (true) WITH CHECK (true);

CREATE POLICY editors_read_client_saved_lots
    ON public.lead_saved_lots FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.leads
            JOIN public.editors ON editors.client_id = ANY(leads.client_id)
            WHERE leads.id = lead_saved_lots.lead_id
            AND editors.user_id = auth.uid()
        )
    );

-- ── lead_sessions (2 policies) ──────────────────────────────────────

CREATE POLICY anon_full_access_sessions
    ON public.lead_sessions FOR ALL TO anon
    USING (true) WITH CHECK (true);

CREATE POLICY editors_read_client_sessions
    ON public.lead_sessions FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.leads
            JOIN public.editors ON editors.client_id = ANY(leads.client_id)
            WHERE leads.id = lead_sessions.lead_id
            AND editors.user_id = auth.uid()
        )
    );

-- Update column comment
COMMENT ON COLUMN public.leads.client_id IS 'Array of client identifiers this lead registered with (e.g. {agora,cpi})';
