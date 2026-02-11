-- Convert leads.is_agent from BOOLEAN to TEXT[] for per-client agent status
-- is_agent = '{agora}' means agent only for agora
-- is_agent = '{agora,cpi}' means agent for both
-- is_agent = NULL means not an agent anywhere

-- For existing agents (is_agent = true), copy their client_id array into is_agent
-- so they remain agents for all clients they currently belong to.

-- Drop the boolean default before converting type
ALTER TABLE public.leads ALTER COLUMN is_agent DROP DEFAULT;

ALTER TABLE public.leads
  ALTER COLUMN is_agent TYPE TEXT[]
  USING CASE
    WHEN is_agent = true THEN client_id
    ELSE NULL
  END;

COMMENT ON COLUMN public.leads.is_agent IS 'Array of client identifiers for which this lead is an agent (e.g. {agora,cpi}), NULL if not an agent';
