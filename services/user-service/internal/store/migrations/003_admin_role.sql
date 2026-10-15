-- Roles gain 'admin': the in-app administrator who manages organiser access
-- (Team screen). Admin is a superset of organiser (see authx.RequireRole).
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('user', 'organiser', 'admin'));
