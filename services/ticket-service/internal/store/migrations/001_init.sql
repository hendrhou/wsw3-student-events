CREATE TABLE IF NOT EXISTS tickets (
  id TEXT PRIMARY KEY,
  booking_ref TEXT NOT NULL UNIQUE,
  event_id TEXT NOT NULL,
  event_title TEXT NOT NULL,
  date_venue_label TEXT NOT NULL,
  event_date DATE NOT NULL,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  student_number TEXT NOT NULL,
  credential JSONB,
  vc_jwt TEXT,
  status TEXT NOT NULL DEFAULT 'Issued' CHECK (status IN ('Issued','Verified','Revoked')),
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_tickets_user ON tickets (user_id);
