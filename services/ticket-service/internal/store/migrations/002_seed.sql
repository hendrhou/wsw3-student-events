-- Dev seeds (idempotent): credentials for the seeded registrations.
-- vc_jwt is left NULL on purpose — the startup signer fills them, which also
-- proves the issuance path on every fresh environment.
INSERT INTO tickets (id, booking_ref, event_id, event_title, date_venue_label, event_date, user_id, user_name, student_number, status) VALUES
  ('tkt_482', 'CP-2026-00482', 'evt-vc-talk', 'Web 3.0: Verifiable Credentials Talk', 'Tue 28 Oct · Auditorium A', '2026-10-28', 'usr_vitor', 'Vítor Carvalho', '20220123', 'Issued'),
  ('tkt_471', 'CP-2026-00471', 'evt-sparql', 'Intro to SPARQL Workshop', 'Fri 24 Oct · Building D, 2.14', '2026-10-24', 'usr_vitor', 'Vítor Carvalho', '20220123', 'Issued'),
  ('tkt_210', 'CP-2026-00210', 'evt-reception', 'Welcome Reception', 'Mon 15 Sep · Main Hall', '2026-09-15', 'usr_vitor', 'Vítor Carvalho', '20220123', 'Verified')
ON CONFLICT (id) DO NOTHING;
