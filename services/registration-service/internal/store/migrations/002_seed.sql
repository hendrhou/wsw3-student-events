-- Dev seeds (idempotent): Vítor registered for two events; one checked in.
INSERT INTO registrations (id, booking_ref, event_id, user_id, user_name, student_number, status, registered_at, checked_in_at) VALUES
  ('reg_482', 'CP-2026-00482', 'evt-vc-talk', 'usr_vitor', 'Vítor Carvalho', '20220123', 'Confirmed', '2026-10-01 14:22', NULL),
  ('reg_471', 'CP-2026-00471', 'evt-sparql', 'usr_vitor', 'Vítor Carvalho', '20220123', 'Confirmed', '2026-10-01 15:03', NULL),
  ('reg_210', 'CP-2026-00210', 'evt-reception', 'usr_vitor', 'Vítor Carvalho', '20220123', 'Checked-in', '2026-09-15 17:40', '2026-09-15 17:58'),
  ('reg_ana', 'CP-2026-00491', 'evt-sparql', 'usr_ana', 'Ana Silva', '20220222', 'Checked-in', '2026-10-01 09:41', '2026-10-24 14:02')
ON CONFLICT (id) DO NOTHING;
