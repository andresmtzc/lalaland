-- Leads table: stores lead information
CREATE TABLE leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT UNIQUE NOT NULL,
  name TEXT,
  last_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Lead tokens table: stores tokens for each device/session
CREATE TABLE lead_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  claimed BOOLEAN DEFAULT FALSE,
  claimed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Lead saved lots table: stores favorited/saved lots per lead
CREATE TABLE lead_saved_lots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  lot_name TEXT NOT NULL,
  client TEXT NOT NULL, -- 'cpi' or 'inverta'
  saved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(lead_id, lot_name, client)
);

-- Indexes for performance
CREATE INDEX idx_leads_phone ON leads(phone);
CREATE INDEX idx_lead_tokens_token ON lead_tokens(token);
CREATE INDEX idx_lead_tokens_lead_id ON lead_tokens(lead_id);
CREATE INDEX idx_lead_saved_lots_lead_id ON lead_saved_lots(lead_id);

-- Enable Row Level Security (optional, for later)
-- ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE lead_tokens ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE lead_saved_lots ENABLE ROW LEVEL SECURITY;
