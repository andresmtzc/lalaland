-- Convert leads.client_id from TEXT to TEXT[] to support multi-product leads
-- A lead who registers in both agora and cpi will have client_id = ['agora','cpi']

-- 1. Drop ALL existing policies on leads, lead_tokens, and lead_saved_lots.
--    Required because ALTER COLUMN TYPE fails if ANY policy references the column,
--    even indirectly (e.g. lead_tokens policies that JOIN through leads.client_id).
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

-- 2. Convert column type (wraps existing single values into arrays)
ALTER TABLE public.leads
  ALTER COLUMN client_id TYPE TEXT[]
  USING CASE WHEN client_id IS NULL THEN NULL ELSE ARRAY[client_id] END;

-- 3. Replace btree index with GIN (supports array operators like @>)
DROP INDEX IF EXISTS idx_leads_client_id;
CREATE INDEX idx_leads_client_ids ON public.leads USING GIN(client_id);

-- 4. Recreate ALL policies on leads, lead_tokens, and lead_saved_lots.
--    This includes anon policies required by registro pages and
--    authenticated policies required by dashboards.

-- ── leads ────────────────────────────────────────────────────────────

-- Anon: registro pages need to look up a lead by phone
CREATE POLICY "Anyone can view leads"
    ON public.leads FOR SELECT TO anon, authenticated USING (true);

-- Anon: registro pages create new leads
CREATE POLICY "Anyone can insert leads"
    ON public.leads FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Anon: registro pages update existing leads (rate-limit fields, client_id append)
CREATE POLICY "Anyone can update leads"
    ON public.leads FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- Authenticated editors: dashboard reads (scoped to their clients)
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

-- ── lead_tokens ──────────────────────────────────────────────────────

-- Anon: registro pages insert tokens after registration
CREATE POLICY "Anyone can insert lead_tokens"
    ON public.lead_tokens FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Anon: registro/index pages may check token status
CREATE POLICY "Anyone can view lead_tokens"
    ON public.lead_tokens FOR SELECT TO anon, authenticated USING (true);

-- Authenticated editors: dashboard reads (scoped through leads → editors)
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

-- ── lead_saved_lots ──────────────────────────────────────────────────

-- Anon: index pages may insert saved lots
CREATE POLICY "Anyone can insert lead_saved_lots"
    ON public.lead_saved_lots FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Anon: index pages may view saved lots
CREATE POLICY "Anyone can view lead_saved_lots"
    ON public.lead_saved_lots FOR SELECT TO anon, authenticated USING (true);

-- Authenticated editors: dashboard reads (scoped through leads → editors)
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

-- Update column comment
COMMENT ON COLUMN public.leads.client_id IS 'Array of client identifiers this lead registered with (e.g. {agora,cpi})';
