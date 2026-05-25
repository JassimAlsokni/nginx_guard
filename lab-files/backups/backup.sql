-- Harmless EC520 Secure Proxy Lab demo backup.
-- This is not a real database dump.

CREATE TABLE users (
  id INT,
  username TEXT,
  role TEXT
);

INSERT INTO users VALUES
  (1, 'training-user-001', 'demo'),
  (2, 'training-admin-002', 'demo-only');
