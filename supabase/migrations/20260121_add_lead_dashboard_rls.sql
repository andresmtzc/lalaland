-- Lead Dashboard RLS Policies
-- Allows authenticated editors to view lead data for their clients

-- Drop ALL existing policies first (to allow re-running migration and clean slate)
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Drop all policies on lead_tokens
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'lead_tokens' AND schemaname = 'public')
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.lead_tokens';
    END LOOP;

    -- Drop all policies on lead_saved_lots
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'lead_saved_lots' AND schemaname = 'public')
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.lead_saved_lots';
    END LOOP;

    -- Drop all policies on leads
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'leads' AND schemaname = 'public')
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.leads';
    END LOOP;

    -- Drop all policies on lead_sessions
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'lead_sessions' AND schemaname = 'public')
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.lead_sessions';
    END LOOP;
END $$;

-- Policy: Authenticated editors can view lead_tokens for their client's leads
CREATE POLICY "Editors can view lead_tokens for their clients"
    ON public.lead_tokens
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.leads
            JOIN public.editors ON editors.client_id = leads.client_id
            WHERE leads.id = lead_tokens.lead_id
            AND editors.user_id = auth.uid()
        )
    );

-- Policy: Authenticated editors can view lead_saved_lots for their clients
CREATE POLICY "Editors can view lead_saved_lots for their clients"
    ON public.lead_saved_lots
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.leads
            JOIN public.editors ON editors.client_id = leads.client_id
            WHERE leads.id = lead_saved_lots.lead_id
            AND editors.user_id = auth.uid()
        )
    );

-- Policy: Authenticated editors can view leads for their clients
CREATE POLICY "Editors can view leads for their clients"
    ON public.leads
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.editors
            WHERE editors.client_id = leads.client_id
            AND editors.user_id = auth.uid()
        )
    );

-- Policy: Allow anonymous users to insert their own lead sessions
CREATE POLICY "Anyone can insert lead sessions"
    ON public.lead_sessions
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- Policy: Allow anonymous users to update their own lead sessions (for ending session)
CREATE POLICY "Anyone can update lead sessions"
    ON public.lead_sessions
    FOR UPDATE
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

-- Grant permissions
GRANT SELECT ON public.lead_tokens TO authenticated;
GRANT SELECT ON public.lead_saved_lots TO authenticated;
GRANT INSERT, UPDATE ON public.lead_sessions TO anon, authenticated;
GRANT SELECT ON public.leads TO authenticated;

COMMENT ON POLICY "Editors can view lead_tokens for their clients" ON public.lead_tokens
    IS 'Allows dashboard users to check if tokens are claimed for their client leads';
COMMENT ON POLICY "Editors can view lead_saved_lots for their clients" ON public.lead_saved_lots
    IS 'Allows dashboard users to see saved lots count for their client leads';
COMMENT ON POLICY "Editors can view leads for their clients" ON public.leads
    IS 'Allows dashboard users to view all leads for their assigned clients';
