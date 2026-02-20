-- Demo Users: Add is_demo flag to lead_tokens and seed John/Jane Doe
-- John Doe  → buyer  demo lead (phone 0000000000)
-- Jane Doe  → agent  demo lead (phone 0000000001)
-- Demo tokens are never claimed and never set cookies — see index.html boot logic.

-- ─────────────────────────────────────────────────────────────
-- 1. Add is_demo flag to lead_tokens
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.lead_tokens
  ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT false;

-- ─────────────────────────────────────────────────────────────
-- 2. John Doe — buyer demo (no agent rights)
-- ─────────────────────────────────────────────────────────────
WITH john_doe AS (
  INSERT INTO public.leads (phone, name, last_name, client_id)
  VALUES ('0000000000', 'Demo', 'User', ARRAY['agora', 'cpi', 'inverta'])
  ON CONFLICT (phone) DO UPDATE
    SET client_id = ARRAY['agora', 'cpi', 'inverta'],
        name      = 'Demo',
        last_name = 'User'
  RETURNING id
)
INSERT INTO public.lead_tokens (lead_id, token, claimed, is_demo)
  SELECT id, 'DEMOAGORA0', false, true FROM john_doe
  UNION ALL
  SELECT id, 'DEMOCPI000', false, true FROM john_doe
  UNION ALL
  SELECT id, 'DEMOINVRT0', false, true FROM john_doe
ON CONFLICT (token) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- 3. Jane Doe — agent demo (is_agent on all clients)
-- ─────────────────────────────────────────────────────────────
WITH jane_doe AS (
  INSERT INTO public.leads (phone, name, last_name, client_id, is_agent)
  VALUES (
    '0000000001',
    'Jane',
    'Doe',
    ARRAY['agora', 'cpi', 'inverta'],
    ARRAY['agora', 'cpi', 'inverta']
  )
  ON CONFLICT (phone) DO UPDATE
    SET client_id = ARRAY['agora', 'cpi', 'inverta'],
        is_agent  = ARRAY['agora', 'cpi', 'inverta'],
        name      = 'Jane',
        last_name = 'Doe'
  RETURNING id
)
INSERT INTO public.lead_tokens (lead_id, token, claimed, is_demo)
  SELECT id, 'DEMOAGORA1', false, true FROM jane_doe
  UNION ALL
  SELECT id, 'DEMOCPI001', false, true FROM jane_doe
  UNION ALL
  SELECT id, 'DEMOINVRT1', false, true FROM jane_doe
ON CONFLICT (token) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- Token reference
-- ─────────────────────────────────────────────────────────────
-- User      | Role   | agora      | cpi        | inverta
-- John Doe  | buyer  | DEMOAGORA0 | DEMOCPI000 | DEMOINVRT0
-- Jane Doe  | agent  | DEMOAGORA1 | DEMOCPI001 | DEMOINVRT1
