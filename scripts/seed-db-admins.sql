-- Seed admin_users table with test users
-- These emails match emulator-test-users.json
-- The backend will auto-update firebase_uid when users sign in

-- Delete existing test users (optional - uncomment if needed)
-- DELETE FROM admin_users WHERE email LIKE '%@test.com';

-- Insert test users
-- Note: firebase_uid can be 'pending' - it will auto-update on first login
INSERT INTO admin_users (email, firebase_uid, display_name, is_super_admin)
VALUES
  ('superadmin@test.com', 'pending-uid-1', 'Super Admin Test', true),
  ('chainadmin@test.com', 'pending-uid-2', 'Chain Admin Test', false),
  ('admin2@test.com', 'pending-uid-3', 'Chain Admin 2', false)
ON CONFLICT (email) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  is_super_admin = EXCLUDED.is_super_admin;

-- Assign chain admins to chains
INSERT INTO admin_chain_assignments (user_id, chain_id)
SELECT user_id, 1 FROM admin_users WHERE email = 'chainadmin@test.com'
ON CONFLICT DO NOTHING;

INSERT INTO admin_chain_assignments (user_id, chain_id)
SELECT user_id, 2 FROM admin_users WHERE email = 'admin2@test.com'
ON CONFLICT DO NOTHING;

-- Verify the results
SELECT
  au.user_id,
  au.email,
  au.display_name,
  au.is_super_admin,
  COALESCE(array_agg(aca.chain_id) FILTER (WHERE aca.chain_id IS NOT NULL), '{}') as chain_ids
FROM admin_users au
LEFT JOIN admin_chain_assignments aca ON au.user_id = aca.user_id
WHERE au.email LIKE '%@test.com'
GROUP BY au.user_id, au.email, au.display_name, au.is_super_admin
ORDER BY au.user_id;
