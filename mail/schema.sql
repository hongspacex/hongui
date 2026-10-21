CREATE TABLE IF NOT EXISTS mailboxes (
  local TEXT PRIMARY KEY,
  pin_hash TEXT,
  pin_salt TEXT,
  token_hash TEXT,
  created_at INTEGER NOT NULL,
  last_access INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  local TEXT NOT NULL,
  from_addr TEXT,
  to_addr TEXT,
  subject TEXT,
  received_at INTEGER NOT NULL,
  size INTEGER NOT NULL,
  r2_key TEXT NOT NULL,
  preview TEXT,
  has_html INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_messages_local_time ON messages(local, received_at DESC);

CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  window_start INTEGER NOT NULL
);
