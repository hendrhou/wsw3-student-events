CREATE TABLE IF NOT EXISTS registrations (
  id TEXT PRIMARY KEY,
  booking_ref TEXT NOT NULL UNIQUE,
  event_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  student_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Confirmed' CHECK (status IN ('Confirmed','Waitlisted','Checked-in','Cancelled')),
  registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  checked_in_at TIMESTAMPTZ
);

-- One active registration per student per event
CREATE UNIQUE INDEX IF NOT EXISTS idx_registrations_active
  ON registrations (event_id, user_id) WHERE status != 'Cancelled';

CREATE INDEX IF NOT EXISTS idx_registrations_event ON registrations (event_id, status);
CREATE INDEX IF NOT EXISTS idx_registrations_user ON registrations (user_id);
