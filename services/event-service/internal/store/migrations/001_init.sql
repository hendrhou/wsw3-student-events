CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 80),
  category TEXT NOT NULL,
  short_description TEXT NOT NULL CHECK (char_length(short_description) <= 200),
  about TEXT NOT NULL DEFAULT '',
  event_date DATE NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  venue TEXT NOT NULL,
  cover_url TEXT,
  capacity_total INT NOT NULL CHECK (capacity_total >= 1),
  capacity_used INT NOT NULL DEFAULT 0 CHECK (capacity_used >= 0),
  checked_in INT NOT NULL DEFAULT 0 CHECK (checked_in >= 0),
  registration_deadline DATE,
  lifecycle_status TEXT NOT NULL DEFAULT 'Draft' CHECK (lifecycle_status IN ('Draft','Published','Cancelled','Past')),
  organiser_id TEXT NOT NULL,
  organiser_name TEXT NOT NULL,
  competences TEXT[] NOT NULL DEFAULT '{}',
  schedule JSONB NOT NULL DEFAULT '[]',
  online BOOLEAN NOT NULL DEFAULT false,
  online_url TEXT,
  topics TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_date ON events (event_date);
CREATE INDEX IF NOT EXISTS idx_events_status ON events (lifecycle_status);
