-- Convert leads.client_id from TEXT to TEXT[] to support multi-product leads
-- A lead who registers in both agora and cpi will have client_id = ['agora','cpi']

-- 1. Convert column type (wraps existing values in an array)
ALTER TABLE public.leads
  ALTER COLUMN client_id TYPE TEXT[]
  USING CASE WHEN client_id IS NULL THEN NULL ELSE ARRAY[client_id] END;

-- 2. Replace btree index with GIN (supports array operators)
DROP INDEX IF EXISTS idx_leads_client_id;
CREATE INDEX idx_leads_client_ids ON public.leads USING GIN(client_id);

-- 3. Update RLS policies that compare editors.client_id (TEXT) with leads.client_id (now TEXT[])
-- We need to recreate the affected policies to use ANY() instead of =

-- 3a. leads policy
DROP POLICY IF EXISTS "Editors can view leads for their clients" ON public.leads;
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

-- 3b. lead_tokens policy (joins through leads)
DROP POLICY IF EXISTS "Editors can view lead_tokens for their clients" ON public.lead_tokens;
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

-- 3c. lead_saved_lots policy (joins through leads)
DROP POLICY IF EXISTS "Editors can view lead_saved_lots for their clients" ON public.lead_saved_lots;
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
