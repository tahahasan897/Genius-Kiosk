-- Migration: Add role column to admin_users and admin_invites
-- Run this on your PostgreSQL database to add the new role-based access control

-- Step 1: Add role column to admin_users
-- Role values: 'super_admin', 'team_admin', 'store_admin'
ALTER TABLE admin_users
ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'store_admin'
CHECK (role IN ('super_admin', 'team_admin', 'store_admin'));

-- Step 2: Migrate existing data based on is_super_admin
-- Super admins get 'super_admin' role
UPDATE admin_users SET role = 'super_admin' WHERE is_super_admin = true;
-- Non-super admins default to 'store_admin' (external clients)
UPDATE admin_users SET role = 'store_admin' WHERE is_super_admin = false;

-- Step 3: Add role column to admin_invites
ALTER TABLE admin_invites
ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'store_admin'
CHECK (role IN ('super_admin', 'team_admin', 'store_admin'));

-- Step 4: Migrate existing invites data
UPDATE admin_invites SET role = 'super_admin' WHERE is_super_admin = true;
UPDATE admin_invites SET role = 'store_admin' WHERE is_super_admin = false;

-- Step 5: Create an index on the role column for better query performance
CREATE INDEX IF NOT EXISTS idx_admin_users_role ON admin_users(role);
CREATE INDEX IF NOT EXISTS idx_admin_invites_role ON admin_invites(role);

-- Note: The is_super_admin column is kept for backwards compatibility
-- It can be removed in a future migration once all code is updated to use 'role'

-- Verification query (run to check the migration worked):
-- SELECT user_id, email, is_super_admin, role FROM admin_users;
-- SELECT invite_id, email, is_super_admin, role FROM admin_invites;
