-- Convert leads.client_id from TEXT to TEXT[] to support multi-product leads
-- A lead who registers in both agora and cpi will have client_id = ['agora','cpi']

-- 1. Drop ALL existing policies on leads (and related tables that join through leads.client_id)
--    This is required because ALTER COLUMN TYPE fails if any policy references the column.
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
END $$;

-- 2. Convert column type (wraps existing values in an array)
ALTER TABLE public.leads
  ALTER COLUMN client_id TYPE TEXT[]
  USING CASE WHEN client_id IS NULL THEN NULL ELSE ARRAY[client_id] END;

-- 3. Replace btree index with GIN (supports array operators)
DROP INDEX IF EXISTS idx_leads_client_id;
CREATE INDEX idx_leads_client_ids ON public.leads USING GIN(client_id);

-- 4. Recreate RLS policies using ANY() for array matching

-- 4a. leads policy
CREATE POLICY "Editors can view leads for their clients"
    ON public.leads
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.editors
            WHERE editors.user_id = auth.uid()
            AND editors.client_id = ANY(leads.client_id)
        )
    );

-- 4b. lead_tokens policy (joins through leads)
CREATE POLICY "Editors can view lead_tokens for their clients"
    ON public.lead_tokens
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.leads
            JOIN public.editors ON editors.client_id = ANY(leads.client_id)
            WHERE leads.id = lead_tokens.lead_id
            AND editors.user_id = auth.uid()
        )
    );

-- 4c. lead_saved_lots policy (joins through leads)
CREATE POLICY "Editors can view lead_saved_lots for their clients"
    ON public.lead_saved_lots
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.leads
            JOIN public.editors ON editors.client_id = ANY(leads.client_id)
            WHERE leads.id = lead_saved_lots.lead_id
            AND editors.user_id = auth.uid()
        )
    );

-- 4d. Restore anon insert/update policies for lead_sessions
CREATE POLICY "Anyone can insert lead sessions"
    ON public.lead_sessions
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

CREATE POLICY "Anyone can update lead sessions"
    ON public.lead_sessions
    FOR UPDATE
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

-- Update column comment
COMMENT ON COLUMN public.leads.client_id IS 'Array of client identifiers this lead registered with (e.g. {agora,cpi})';
