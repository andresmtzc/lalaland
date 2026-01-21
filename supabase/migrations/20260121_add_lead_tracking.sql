-- Lead Tracking Enhancement: Add client_id and session tracking
-- Adds client isolation and visit/engagement tracking for lead scoring

-- 1. Add client_id to leads table
ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS client_id TEXT;

-- Create index for client filtering
CREATE INDEX IF NOT EXISTS idx_leads_client_id
    ON public.leads(client_id);

-- 2. Create lead_sessions table for visit tracking
CREATE TABLE IF NOT EXISTS public.lead_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Lead reference
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,

    -- Client reference
    client_id TEXT NOT NULL,

    -- Session timing
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER,

    -- Session metadata
    page_url TEXT,
    user_agent TEXT,

    CONSTRAINT lead_sessions_valid_duration CHECK (duration_seconds IS NULL OR duration_seconds >= 0)
);

-- Indexes for lead_sessions
CREATE INDEX IF NOT EXISTS idx_lead_sessions_lead_id
    ON public.lead_sessions(lead_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_lead_sessions_client_id
    ON public.lead_sessions(client_id, started_at DESC);

-- Enable Row Level Security
ALTER TABLE public.lead_sessions ENABLE ROW LEVEL SECURITY;

-- Policy: Service role has full access (for API and edge functions)
CREATE POLICY "Service role has full access to lead_sessions"
    ON public.lead_sessions
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Policy: Authenticated users can view sessions for their clients
CREATE POLICY "Users can view lead_sessions for their clients"
    ON public.lead_sessions
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.editors
            WHERE editors.user_id = auth.uid()
            AND editors.client_id = lead_sessions.client_id
        )
    );

-- Grant permissions
GRANT SELECT ON public.lead_sessions TO authenticated;
GRANT ALL ON public.lead_sessions TO service_role;

-- Add comments for documentation
COMMENT ON COLUMN public.leads.client_id IS 'Client identifier (inverta, cpi, agora, etc.) extracted from URL slug';
COMMENT ON TABLE public.lead_sessions IS 'Tracks individual map page visits for lead engagement scoring';
