-- Instagram Collab Bot: Comment tracking and DM automation
-- Creates table to store Instagram comment requests for registration links

CREATE TABLE IF NOT EXISTS public.collab_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Instagram user info
    instagram_user_id TEXT NOT NULL,
    instagram_username TEXT NOT NULL,

    -- Post/comment details
    post_id TEXT NOT NULL,
    comment_id TEXT NOT NULL,
    comment_text TEXT NOT NULL,
    keyword TEXT NOT NULL,  -- PIETRA, AQUA, CAÑADAS, etc.

    -- Client mapping
    client_id TEXT NOT NULL,

    -- Form link to send in DM
    form_link TEXT NOT NULL,

    -- Processing status
    status TEXT NOT NULL DEFAULT 'pending',  -- pending, processing, completed, error

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,

    -- Error tracking
    error_message TEXT,

    -- Metadata
    post_type TEXT,  -- 'POST', 'REEL', 'STORY'

    -- Prevent duplicate processing
    CONSTRAINT unique_comment_per_request UNIQUE (comment_id)
);

-- Index for bot polling query (fetch pending requests)
CREATE INDEX IF NOT EXISTS idx_collab_requests_status_created
    ON public.collab_requests(status, created_at)
    WHERE status = 'pending';

-- Index for analytics (count by post)
CREATE INDEX IF NOT EXISTS idx_collab_requests_post_id
    ON public.collab_requests(post_id, created_at);

-- Index for client analytics
CREATE INDEX IF NOT EXISTS idx_collab_requests_client_keyword
    ON public.collab_requests(client_id, keyword, created_at);

-- Enable Row Level Security
ALTER TABLE public.collab_requests ENABLE ROW LEVEL SECURITY;

-- Policy: Allow service role full access (for bot and edge functions)
CREATE POLICY "Service role has full access to collab_requests"
    ON public.collab_requests
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Policy: Authenticated users can view their client's requests
CREATE POLICY "Users can view collab_requests for their clients"
    ON public.collab_requests
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.editors
            WHERE editors.user_id = auth.uid()
            AND editors.client_id = collab_requests.client_id
        )
    );

-- Grant access to authenticated users and service role
GRANT SELECT ON public.collab_requests TO authenticated;
GRANT ALL ON public.collab_requests TO service_role;

-- Add comment for documentation
COMMENT ON TABLE public.collab_requests IS 'Instagram collaboration post comment tracking for automated registration link delivery';
