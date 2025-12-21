import { query } from '../db.js';

/**
 * Role constants
 * - super_admin: Full access to everything
 * - team_admin: Access to /team page, chain-specific support role
 * - store_admin: Access to /admin page only, chain-specific
 */
export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  TEAM_ADMIN: 'team_admin',
  STORE_ADMIN: 'store_admin'
};

/**
 * Middleware: Require Admin (any admin - super, team, or store)
 * Attaches adminUser to request with: user_id, email, display_name, is_super_admin, role, chain_id, chain_ids
 */
export const requireAdmin = async (req, res, next) => {
  try {
    const firebaseUid = req.headers['x-firebase-uid'];

    if (!firebaseUid) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check if user exists in admin_users and get their chain assignments
    // Include role column (defaults to 'store_admin' if null for backwards compatibility)
    const result = await query(
      `SELECT au.user_id, au.email, au.display_name, au.is_super_admin, au.chain_id,
              COALESCE(au.role, CASE WHEN au.is_super_admin THEN 'super_admin' ELSE 'store_admin' END) as role,
              COALESCE(array_agg(aca.chain_id) FILTER (WHERE aca.chain_id IS NOT NULL), '{}') as chain_ids
       FROM admin_users au
       LEFT JOIN admin_chain_assignments aca ON au.user_id = aca.user_id
       WHERE au.firebase_uid = $1
       GROUP BY au.user_id, au.email, au.display_name, au.is_super_admin, au.chain_id, au.role`,
      [firebaseUid]
    );

    if (result.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied. Not an admin user.' });
    }

    const adminUser = result.rows[0];
    // Ensure chain_ids is always an array
    adminUser.chain_ids = adminUser.chain_ids || [];

    // Attach admin user to request for use in routes
    req.adminUser = adminUser;

    // Update last login
    await query(
      'UPDATE admin_users SET last_login = CURRENT_TIMESTAMP WHERE user_id = $1',
      [adminUser.user_id]
    );

    next();
  } catch (error) {
    console.error('Admin auth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

/**
 * Middleware: Require Team Admin (super_admin or team_admin - NOT store_admin)
 * This protects the /team page - store admins cannot access it
 */
export const requireTeamAdmin = async (req, res, next) => {
  try {
    const firebaseUid = req.headers['x-firebase-uid'];

    if (!firebaseUid) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check if user exists and get their role
    const result = await query(
      `SELECT user_id, email, display_name, is_super_admin, chain_id,
              COALESCE(role, CASE WHEN is_super_admin THEN 'super_admin' ELSE 'store_admin' END) as role
       FROM admin_users WHERE firebase_uid = $1`,
      [firebaseUid]
    );

    if (result.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied. Not an admin user.' });
    }

    const adminUser = result.rows[0];

    // Only super_admin and team_admin can access - store_admin is blocked
    if (adminUser.role !== ROLES.SUPER_ADMIN && adminUser.role !== ROLES.TEAM_ADMIN) {
      return res.status(403).json({ error: 'Access denied. Team or Super admin privileges required.' });
    }

    // Attach admin user to request for use in routes
    req.adminUser = adminUser;

    // Update last login
    await query(
      'UPDATE admin_users SET last_login = CURRENT_TIMESTAMP WHERE user_id = $1',
      [adminUser.user_id]
    );

    next();
  } catch (error) {
    console.error('Team admin auth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

/**
 * Middleware: Require Super Admin (for admin management only)
 */
export const requireSuperAdmin = async (req, res, next) => {
  try {
    const firebaseUid = req.headers['x-firebase-uid'];

    if (!firebaseUid) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check if user exists in admin_users and is a super admin
    const result = await query(
      `SELECT user_id, email, display_name, is_super_admin, chain_id,
              COALESCE(role, CASE WHEN is_super_admin THEN 'super_admin' ELSE 'store_admin' END) as role
       FROM admin_users WHERE firebase_uid = $1`,
      [firebaseUid]
    );

    if (result.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied. Not an admin user.' });
    }

    const adminUser = result.rows[0];

    // Check both is_super_admin (legacy) and role (new)
    if (!adminUser.is_super_admin && adminUser.role !== ROLES.SUPER_ADMIN) {
      return res.status(403).json({ error: 'Access denied. Super admin privileges required.' });
    }

    // Attach admin user to request for use in routes
    req.adminUser = adminUser;

    // Update last login
    await query(
      'UPDATE admin_users SET last_login = CURRENT_TIMESTAMP WHERE user_id = $1',
      [adminUser.user_id]
    );

    next();
  } catch (error) {
    console.error('Super admin auth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

/**
 * Helper: Check if admin has access to a specific store
 * Returns true if super admin OR if store's chain is in admin's chain_ids
 */
export const canAccessStore = async (adminUser, storeId) => {
  // Super admins can access all stores
  if (adminUser.is_super_admin || adminUser.role === ROLES.SUPER_ADMIN) {
    return true;
  }

  const result = await query(
    'SELECT chain_id FROM stores WHERE store_id = $1',
    [storeId]
  );

  if (result.rows.length === 0) {
    return false;
  }

  const storeChainId = result.rows[0].chain_id;
  return adminUser.chain_ids.includes(storeChainId);
};

/**
 * Helper: Check if admin has access to a specific chain
 */
export const canAccessChain = (adminUser, chainId) => {
  // Super admins can access all chains
  if (adminUser.is_super_admin || adminUser.role === ROLES.SUPER_ADMIN) {
    return true;
  }
  return adminUser.chain_ids.includes(chainId);
};

/**
 * Helper: Check if user can access the /team page
 * Only super_admin and team_admin can access (NOT store_admin)
 */
export const canAccessTeamPage = (adminUser) => {
  return adminUser.role === ROLES.SUPER_ADMIN || adminUser.role === ROLES.TEAM_ADMIN;
};
