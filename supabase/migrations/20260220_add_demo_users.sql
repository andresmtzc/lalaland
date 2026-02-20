-- Demo Users: Seed John/Jane Doe as demo leads
-- John Doe  → buyer  demo lead (phone 0000000000)
-- Jane Doe  → agent  demo lead (phone 0000000001)
-- Demo tokens are never claimed and never set cookies — see index.html boot logic.

-- ─────────────────────────────────────────────────────────────
-- 1. Add is_demo flag to leads
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT false;

-- ─────────────────────────────────────────────────────────────
-- 2. John Doe — buyer demo (no agent rights)
-- ─────────────────────────────────────────────────────────────
WITH john_doe AS (
  INSERT INTO public.leads (phone, name, last_name, client_id, is_demo)
  VALUES ('0000000000', 'Demo', 'User', ARRAY['agora', 'cpi', 'inverta'], true)
  ON CONFLICT (phone) DO UPDATE
    SET client_id = ARRAY['agora', 'cpi', 'inverta'],
        name      = 'Demo',
        last_name = 'User',
        is_demo   = true
  RETURNING id
)
INSERT INTO public.lead_tokens (lead_id, token, claimed)
  SELECT id, 'DEMOAGORA0', false FROM john_doe
  UNION ALL
  SELECT id, 'DEMOCPI000', false FROM john_doe
  UNION ALL
  SELECT id, 'DEMOINVRT0', false FROM john_doe
ON CONFLICT (token) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- 3. Jane Doe — agent demo (is_agent on all clients)
-- ─────────────────────────────────────────────────────────────
WITH jane_doe AS (
  INSERT INTO public.leads (phone, name, last_name, client_id, is_agent, is_demo)
  VALUES (
    '0000000001',
    'Jane',
    'Doe',
    ARRAY['agora', 'cpi', 'inverta'],
    ARRAY['agora', 'cpi', 'inverta'],
    true
  )
  ON CONFLICT (phone) DO UPDATE
    SET client_id = ARRAY['agora', 'cpi', 'inverta'],
        is_agent  = ARRAY['agora', 'cpi', 'inverta'],
        name      = 'Jane',
        last_name = 'Doe',
        is_demo   = true
  RETURNING id
)
INSERT INTO public.lead_tokens (lead_id, token, claimed)
  SELECT id, 'DEMOAGORA1', false FROM jane_doe
  UNION ALL
  SELECT id, 'DEMOCPI001', false FROM jane_doe
  UNION ALL
  SELECT id, 'DEMOINVRT1', false FROM jane_doe
ON CONFLICT (token) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- Token reference
-- ─────────────────────────────────────────────────────────────
-- User      | Role   | agora      | cpi        | inverta
-- John Doe  | buyer  | DEMOAGORA0 | DEMOCPI000 | DEMOINVRT0
-- Jane Doe  | agent  | DEMOAGORA1 | DEMOCPI001 | DEMOINVRT1
