-- Dev seeds (idempotent). Olga is the demo organiser; Vítor the demo student.
-- Organiser elevation is a database flag, never self-service.
INSERT INTO users (id, email, name, student_number, role) VALUES
  ('usr_vitor', 'vitor@ufp.edu.pt', 'Vítor Carvalho', '20220123', 'user'),
  ('usr_olga', 'olga@ufp.edu.pt', 'Olga Ribeiro', 'staff001', 'organiser')
ON CONFLICT (id) DO NOTHING;
