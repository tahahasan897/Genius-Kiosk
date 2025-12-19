import express from 'express';
import pool, { query } from '../db.js';

const router = express.Router();

// ============================================
// MIDDLEWARE: Require Super Admin
// ============================================

const requireSuperAdmin = async (req, res, next) => {
  try {
    const firebaseUid = req.headers['x-firebase-uid'];

    if (!firebaseUid) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check if user exists in admin_users and is a super admin
    const result = await query(
      'SELECT user_id, email, display_name, is_super_admin FROM admin_users WHERE firebase_uid = $1',
      [firebaseUid]
    );

    if (result.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied. Not an admin user.' });
    }

    const adminUser = result.rows[0];

    if (!adminUser.is_super_admin) {
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

// ============================================
// ADMIN USER CHECK (No auth required - used to check role)
// Also handles bootstrap and invite auto-promotion
// ============================================

router.get('/me', async (req, res) => {
  try {
    const firebaseUid = req.headers['x-firebase-uid'];
    const userEmail = req.headers['x-firebase-email'];

    if (!firebaseUid) {
      return res.json({ isAdmin: false, isSuperAdmin: false });
    }

    // Check if user already exists as admin
    const existingAdmin = await query(
      'SELECT user_id, email, display_name, is_super_admin, chain_id FROM admin_users WHERE firebase_uid = $1',
      [firebaseUid]
    );

    if (existingAdmin.rows.length > 0) {
      const adminUser = existingAdmin.rows[0];
      return res.json({
        isAdmin: true,
        isSuperAdmin: adminUser.is_super_admin,
        userId: adminUser.user_id,
        email: adminUser.email,
        displayName: adminUser.display_name,
        chainId: adminUser.chain_id
      });
    }

    // User is not an admin yet - check for bootstrap or invite
    if (userEmail) {
      // BOOTSTRAP: Check if this is the bootstrap super admin email and no admins exist
      const bootstrapEmail = process.env.BOOTSTRAP_SUPER_ADMIN_EMAIL;
      if (bootstrapEmail && userEmail.toLowerCase() === bootstrapEmail.toLowerCase()) {
        const adminCount = await query('SELECT COUNT(*) FROM admin_users');
        if (parseInt(adminCount.rows[0].count) === 0) {
          // Create the first super admin
          const newAdmin = await query(
            `INSERT INTO admin_users (firebase_uid, email, display_name, is_super_admin)
             VALUES ($1, $2, $3, true)
             RETURNING user_id, email, display_name, is_super_admin, chain_id`,
            [firebaseUid, userEmail, 'Super Admin']
          );
          console.log(`✅ Bootstrap: Created first super admin for ${userEmail}`);
          return res.json({
            isAdmin: true,
            isSuperAdmin: true,
            userId: newAdmin.rows[0].user_id,
            email: newAdmin.rows[0].email,
            displayName: newAdmin.rows[0].display_name,
            chainId: null,
            bootstrapped: true
          });
        }
      }

      // INVITE: Check if there's a pending invite for this email
      const invite = await query(
        'SELECT invite_id, email, is_super_admin, chain_id FROM admin_invites WHERE LOWER(email) = LOWER($1) AND accepted_at IS NULL',
        [userEmail]
      );

      if (invite.rows.length > 0) {
        const pendingInvite = invite.rows[0];

        // Create the admin user from the invite
        const newAdmin = await query(
          `INSERT INTO admin_users (firebase_uid, email, display_name, is_super_admin, chain_id)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING user_id, email, display_name, is_super_admin, chain_id`,
          [firebaseUid, userEmail, null, pendingInvite.is_super_admin, pendingInvite.chain_id]
        );

        // Mark invite as accepted
        await query(
          'UPDATE admin_invites SET accepted_at = CURRENT_TIMESTAMP WHERE invite_id = $1',
          [pendingInvite.invite_id]
        );

        console.log(`✅ Invite accepted: ${userEmail} is now an admin`);
        return res.json({
          isAdmin: true,
          isSuperAdmin: newAdmin.rows[0].is_super_admin,
          userId: newAdmin.rows[0].user_id,
          email: newAdmin.rows[0].email,
          displayName: newAdmin.rows[0].display_name,
          chainId: newAdmin.rows[0].chain_id,
          inviteAccepted: true
        });
      }
    }

    // No admin record, no bootstrap, no invite
    return res.json({ isAdmin: false, isSuperAdmin: false });
  } catch (error) {
    console.error('Error checking admin status:', error);
    res.status(500).json({ error: 'Failed to check admin status' });
  }
});

// ============================================
// DASHBOARD
// ============================================

router.get('/dashboard', requireSuperAdmin, async (req, res) => {
  try {
    // Get total chains count
    const chainsResult = await query(
      'SELECT COUNT(*) FROM chains WHERE is_active = true'
    );
    const totalChains = parseInt(chainsResult.rows[0].count);

    // Get total stores count
    const storesResult = await query(
      'SELECT COUNT(*) FROM stores WHERE is_active = true'
    );
    const totalStores = parseInt(storesResult.rows[0].count);

    // Get total products count
    const productsResult = await query('SELECT COUNT(*) FROM products');
    const totalProducts = parseInt(productsResult.rows[0].count);

    // Get total admin users count
    const adminsResult = await query('SELECT COUNT(*) FROM admin_users');
    const totalAdmins = parseInt(adminsResult.rows[0].count);

    // Get recently created chains
    const recentChainsResult = await query(
      `SELECT chain_id, chain_name, created_at
       FROM chains
       WHERE is_active = true
       ORDER BY created_at DESC
       LIMIT 5`
    );

    // Get recently created stores
    const recentStoresResult = await query(
      `SELECT s.store_id, s.store_name, s.created_at, c.chain_name
       FROM stores s
       JOIN chains c ON s.chain_id = c.chain_id
       WHERE s.is_active = true
       ORDER BY s.created_at DESC
       LIMIT 5`
    );

    // Get chains with store counts
    const chainStoreCountsResult = await query(
      `SELECT c.chain_id, c.chain_name, COUNT(s.store_id) as store_count
       FROM chains c
       LEFT JOIN stores s ON c.chain_id = s.chain_id AND s.is_active = true
       WHERE c.is_active = true
       GROUP BY c.chain_id, c.chain_name
       ORDER BY store_count DESC
       LIMIT 5`
    );

    res.json({
      stats: {
        totalChains,
        totalStores,
        totalProducts,
        totalAdmins
      },
      recentChains: recentChainsResult.rows,
      recentStores: recentStoresResult.rows,
      topChains: chainStoreCountsResult.rows
    });
  } catch (error) {
    console.error('Error fetching super admin dashboard:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data', details: error.message });
  }
});

// ============================================
// CHAINS CRUD
// ============================================

// Get all chains with stats
router.get('/chains', requireSuperAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 50, search = '', includeInactive = 'false' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let whereClause = includeInactive === 'true' ? '' : 'WHERE c.is_active = true';
    const params = [];

    if (search) {
      whereClause = whereClause
        ? `${whereClause} AND LOWER(c.chain_name) LIKE $1`
        : 'WHERE LOWER(c.chain_name) LIKE $1';
      params.push(`%${search.toLowerCase()}%`);
    }

    const chainsResult = await query(
      `SELECT
        c.chain_id,
        c.chain_name,
        c.is_active,
        c.created_at,
        COUNT(DISTINCT s.store_id) FILTER (WHERE s.is_active = true) as store_count,
        COUNT(DISTINCT p.product_id) as product_count
       FROM chains c
       LEFT JOIN stores s ON c.chain_id = s.chain_id
       LEFT JOIN products p ON c.chain_id = p.chain_id
       ${whereClause}
       GROUP BY c.chain_id, c.chain_name, c.is_active, c.created_at
       ORDER BY c.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, parseInt(limit), offset]
    );

    // Get total count
    const countParams = search ? [`%${search.toLowerCase()}%`] : [];
    const countWhere = includeInactive === 'true'
      ? (search ? 'WHERE LOWER(chain_name) LIKE $1' : '')
      : (search ? 'WHERE is_active = true AND LOWER(chain_name) LIKE $1' : 'WHERE is_active = true');

    const countResult = await query(
      `SELECT COUNT(*) FROM chains ${countWhere}`,
      countParams
    );
    const total = parseInt(countResult.rows[0].count);

    res.json({
      chains: chainsResult.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching chains:', error);
    res.status(500).json({ error: 'Failed to fetch chains', details: error.message });
  }
});

// Get single chain
router.get('/chains/:id', requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT
        c.chain_id,
        c.chain_name,
        c.is_active,
        c.created_at,
        COUNT(DISTINCT s.store_id) FILTER (WHERE s.is_active = true) as store_count,
        COUNT(DISTINCT p.product_id) as product_count
       FROM chains c
       LEFT JOIN stores s ON c.chain_id = s.chain_id
       LEFT JOIN products p ON c.chain_id = p.chain_id
       WHERE c.chain_id = $1
       GROUP BY c.chain_id, c.chain_name, c.is_active, c.created_at`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Chain not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching chain:', error);
    res.status(500).json({ error: 'Failed to fetch chain', details: error.message });
  }
});

// Create chain
router.post('/chains', requireSuperAdmin, async (req, res) => {
  try {
    const { chain_name } = req.body;

    if (!chain_name || !chain_name.trim()) {
      return res.status(400).json({ error: 'Chain name is required' });
    }

    const result = await query(
      `INSERT INTO chains (chain_name, is_active)
       VALUES ($1, true)
       RETURNING chain_id, chain_name, is_active, created_at`,
      [chain_name.trim()]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating chain:', error);
    if (error.code === '23505') {
      res.status(400).json({ error: 'A chain with this name already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create chain', details: error.message });
    }
  }
});

// Update chain
router.put('/chains/:id', requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { chain_name, is_active } = req.body;

    if (!chain_name || !chain_name.trim()) {
      return res.status(400).json({ error: 'Chain name is required' });
    }

    const result = await query(
      `UPDATE chains
       SET chain_name = $1, is_active = $2
       WHERE chain_id = $3
       RETURNING chain_id, chain_name, is_active, created_at`,
      [chain_name.trim(), is_active !== false, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Chain not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating chain:', error);
    if (error.code === '23505') {
      res.status(400).json({ error: 'A chain with this name already exists' });
    } else {
      res.status(500).json({ error: 'Failed to update chain', details: error.message });
    }
  }
});

// Delete chain (soft delete)
router.delete('/chains/:id', requireSuperAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;

    await client.query('BEGIN');

    // Soft delete the chain
    const chainResult = await client.query(
      `UPDATE chains SET is_active = false WHERE chain_id = $1 RETURNING chain_id, chain_name`,
      [id]
    );

    if (chainResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Chain not found' });
    }

    // Soft delete all stores under this chain
    await client.query(
      `UPDATE stores SET is_active = false WHERE chain_id = $1`,
      [id]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Chain and associated stores have been deactivated',
      chain: chainResult.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting chain:', error);
    res.status(500).json({ error: 'Failed to delete chain', details: error.message });
  } finally {
    client.release();
  }
});

// Restore chain (reactivate)
router.post('/chains/:id/restore', requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `UPDATE chains SET is_active = true WHERE chain_id = $1 RETURNING chain_id, chain_name`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Chain not found' });
    }

    res.json({
      success: true,
      message: 'Chain has been reactivated',
      chain: result.rows[0]
    });
  } catch (error) {
    console.error('Error restoring chain:', error);
    res.status(500).json({ error: 'Failed to restore chain', details: error.message });
  }
});

// ============================================
// STORES CRUD
// ============================================

// Get stores (optionally by chain)
router.get('/stores', requireSuperAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 50, search = '', chainId, includeInactive = 'false' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const params = [];
    const conditions = [];

    if (includeInactive !== 'true') {
      conditions.push('s.is_active = true');
    }

    if (chainId) {
      params.push(chainId);
      conditions.push(`s.chain_id = $${params.length}`);
    }

    if (search) {
      params.push(`%${search.toLowerCase()}%`);
      conditions.push(`(LOWER(s.store_name) LIKE $${params.length} OR LOWER(s.address) LIKE $${params.length})`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const storesResult = await query(
      `SELECT
        s.store_id,
        s.chain_id,
        s.store_name,
        s.address,
        s.city,
        s.state,
        s.zip_code,
        s.phone,
        s.is_active,
        s.created_at,
        s.map_published_at,
        c.chain_name,
        COUNT(DISTINCT sme.id) as map_elements_count,
        COUNT(DISTINCT p.product_id) as products_count
       FROM stores s
       JOIN chains c ON s.chain_id = c.chain_id
       LEFT JOIN store_map_elements sme ON s.store_id = sme.store_id
       LEFT JOIN store_inventory si ON s.store_id = si.store_id
       LEFT JOIN products p ON si.product_id = p.product_id
       ${whereClause}
       GROUP BY s.store_id, s.chain_id, s.store_name, s.address, s.city, s.state, s.zip_code, s.phone, s.is_active, s.created_at, s.map_published_at, c.chain_name
       ORDER BY s.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, parseInt(limit), offset]
    );

    // Get total count
    const countConditions = [];
    const countParams = [];

    if (includeInactive !== 'true') {
      countConditions.push('is_active = true');
    }

    if (chainId) {
      countParams.push(chainId);
      countConditions.push(`chain_id = $${countParams.length}`);
    }

    if (search) {
      countParams.push(`%${search.toLowerCase()}%`);
      countConditions.push(`(LOWER(store_name) LIKE $${countParams.length} OR LOWER(address) LIKE $${countParams.length})`);
    }

    const countWhereClause = countConditions.length > 0 ? `WHERE ${countConditions.join(' AND ')}` : '';

    const countResult = await query(
      `SELECT COUNT(*) FROM stores ${countWhereClause}`,
      countParams
    );
    const total = parseInt(countResult.rows[0].count);

    res.json({
      stores: storesResult.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching stores:', error);
    res.status(500).json({ error: 'Failed to fetch stores', details: error.message });
  }
});

// Get stores by chain ID
router.get('/chains/:chainId/stores', requireSuperAdmin, async (req, res) => {
  try {
    const { chainId } = req.params;
    const { includeInactive = 'false' } = req.query;

    const whereClause = includeInactive === 'true'
      ? 'WHERE s.chain_id = $1'
      : 'WHERE s.chain_id = $1 AND s.is_active = true';

    const result = await query(
      `SELECT
        s.store_id,
        s.chain_id,
        s.store_name,
        s.address,
        s.city,
        s.state,
        s.zip_code,
        s.phone,
        s.is_active,
        s.created_at,
        s.map_published_at
       FROM stores s
       ${whereClause}
       ORDER BY s.store_name`,
      [chainId]
    );

    res.json({ stores: result.rows });
  } catch (error) {
    console.error('Error fetching stores for chain:', error);
    res.status(500).json({ error: 'Failed to fetch stores', details: error.message });
  }
});

// Get single store
router.get('/stores/:id', requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT
        s.store_id,
        s.chain_id,
        s.store_name,
        s.address,
        s.city,
        s.state,
        s.zip_code,
        s.phone,
        s.is_active,
        s.created_at,
        s.map_published_at,
        c.chain_name
       FROM stores s
       JOIN chains c ON s.chain_id = c.chain_id
       WHERE s.store_id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Store not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching store:', error);
    res.status(500).json({ error: 'Failed to fetch store', details: error.message });
  }
});

// Create store
router.post('/stores', requireSuperAdmin, async (req, res) => {
  try {
    const { chain_id, store_name, address, city, state, zip_code, phone } = req.body;

    if (!chain_id) {
      return res.status(400).json({ error: 'Chain ID is required' });
    }

    if (!store_name || !store_name.trim()) {
      return res.status(400).json({ error: 'Store name is required' });
    }

    // Verify chain exists and is active
    const chainCheck = await query(
      'SELECT chain_id FROM chains WHERE chain_id = $1 AND is_active = true',
      [chain_id]
    );

    if (chainCheck.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or inactive chain' });
    }

    const result = await query(
      `INSERT INTO stores (chain_id, store_name, address, city, state, zip_code, phone, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true)
       RETURNING store_id, chain_id, store_name, address, city, state, zip_code, phone, is_active, created_at`,
      [chain_id, store_name.trim(), address || null, city || null, state || null, zip_code || null, phone || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating store:', error);
    res.status(500).json({ error: 'Failed to create store', details: error.message });
  }
});

// Update store
router.put('/stores/:id', requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { chain_id, store_name, address, city, state, zip_code, phone, is_active } = req.body;

    if (!store_name || !store_name.trim()) {
      return res.status(400).json({ error: 'Store name is required' });
    }

    // If changing chain, verify new chain exists and is active
    if (chain_id) {
      const chainCheck = await query(
        'SELECT chain_id FROM chains WHERE chain_id = $1 AND is_active = true',
        [chain_id]
      );

      if (chainCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid or inactive chain' });
      }
    }

    const result = await query(
      `UPDATE stores
       SET chain_id = COALESCE($1, chain_id),
           store_name = $2,
           address = $3,
           city = $4,
           state = $5,
           zip_code = $6,
           phone = $7,
           is_active = $8
       WHERE store_id = $9
       RETURNING store_id, chain_id, store_name, address, city, state, zip_code, phone, is_active, created_at`,
      [chain_id || null, store_name.trim(), address || null, city || null, state || null, zip_code || null, phone || null, is_active !== false, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Store not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating store:', error);
    res.status(500).json({ error: 'Failed to update store', details: error.message });
  }
});

// Delete store (soft delete)
router.delete('/stores/:id', requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `UPDATE stores SET is_active = false WHERE store_id = $1 RETURNING store_id, store_name`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Store not found' });
    }

    res.json({
      success: true,
      message: 'Store has been deactivated',
      store: result.rows[0]
    });
  } catch (error) {
    console.error('Error deleting store:', error);
    res.status(500).json({ error: 'Failed to delete store', details: error.message });
  }
});

// Restore store (reactivate)
router.post('/stores/:id/restore', requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if parent chain is active
    const storeCheck = await query(
      `SELECT s.store_id, c.is_active as chain_active
       FROM stores s
       JOIN chains c ON s.chain_id = c.chain_id
       WHERE s.store_id = $1`,
      [id]
    );

    if (storeCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Store not found' });
    }

    if (!storeCheck.rows[0].chain_active) {
      return res.status(400).json({ error: 'Cannot restore store - parent chain is inactive. Restore the chain first.' });
    }

    const result = await query(
      `UPDATE stores SET is_active = true WHERE store_id = $1 RETURNING store_id, store_name`,
      [id]
    );

    res.json({
      success: true,
      message: 'Store has been reactivated',
      store: result.rows[0]
    });
  } catch (error) {
    console.error('Error restoring store:', error);
    res.status(500).json({ error: 'Failed to restore store', details: error.message });
  }
});

// ============================================
// ADMIN USERS MANAGEMENT
// ============================================

// Get all admin users
router.get('/admins', requireSuperAdmin, async (req, res) => {
  try {
    const result = await query(
      `SELECT
        au.user_id,
        au.firebase_uid,
        au.email,
        au.display_name,
        au.is_super_admin,
        au.chain_id,
        au.created_at,
        au.last_login,
        c.chain_name
       FROM admin_users au
       LEFT JOIN chains c ON au.chain_id = c.chain_id
       ORDER BY au.created_at DESC`
    );

    res.json({ admins: result.rows });
  } catch (error) {
    console.error('Error fetching admin users:', error);
    res.status(500).json({ error: 'Failed to fetch admin users', details: error.message });
  }
});

// Add admin user
router.post('/admins', requireSuperAdmin, async (req, res) => {
  try {
    const { firebase_uid, email, display_name, is_super_admin, chain_id } = req.body;

    if (!firebase_uid) {
      return res.status(400).json({ error: 'Firebase UID is required' });
    }

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const result = await query(
      `INSERT INTO admin_users (firebase_uid, email, display_name, is_super_admin, chain_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING user_id, firebase_uid, email, display_name, is_super_admin, chain_id, created_at`,
      [firebase_uid, email, display_name || null, is_super_admin || false, chain_id || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating admin user:', error);
    if (error.code === '23505') {
      res.status(400).json({ error: 'An admin user with this Firebase UID already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create admin user', details: error.message });
    }
  }
});

// Update admin user
router.put('/admins/:id', requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { display_name, is_super_admin, chain_id } = req.body;

    const result = await query(
      `UPDATE admin_users
       SET display_name = $1, is_super_admin = $2, chain_id = $3
       WHERE user_id = $4
       RETURNING user_id, firebase_uid, email, display_name, is_super_admin, chain_id, created_at`,
      [display_name || null, is_super_admin || false, chain_id || null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Admin user not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating admin user:', error);
    res.status(500).json({ error: 'Failed to update admin user', details: error.message });
  }
});

// Delete admin user
router.delete('/admins/:id', requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent self-deletion
    if (req.adminUser.user_id === parseInt(id)) {
      return res.status(400).json({ error: 'Cannot delete your own admin account' });
    }

    const result = await query(
      'DELETE FROM admin_users WHERE user_id = $1 RETURNING user_id, email',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Admin user not found' });
    }

    // Also delete any associated invite so they can be re-invited
    const deletedAdmin = result.rows[0];
    await query(
      'DELETE FROM admin_invites WHERE LOWER(email) = LOWER($1)',
      [deletedAdmin.email]
    );

    res.json({
      success: true,
      message: 'Admin user has been deleted',
      admin: deletedAdmin
    });
  } catch (error) {
    console.error('Error deleting admin user:', error);
    res.status(500).json({ error: 'Failed to delete admin user', details: error.message });
  }
});

// ============================================
// ADMIN INVITES
// ============================================

// Get all invites (pending and accepted)
router.get('/invites', requireSuperAdmin, async (req, res) => {
  try {
    const { status = 'all' } = req.query;

    let whereClause = '';
    if (status === 'pending') {
      whereClause = 'WHERE ai.accepted_at IS NULL';
    } else if (status === 'accepted') {
      whereClause = 'WHERE ai.accepted_at IS NOT NULL';
    }

    const result = await query(
      `SELECT
        ai.invite_id,
        ai.email,
        ai.is_super_admin,
        ai.chain_id,
        ai.created_at,
        ai.accepted_at,
        c.chain_name,
        inviter.email as invited_by_email
       FROM admin_invites ai
       LEFT JOIN chains c ON ai.chain_id = c.chain_id
       LEFT JOIN admin_users inviter ON ai.invited_by = inviter.user_id
       ${whereClause}
       ORDER BY ai.created_at DESC`
    );

    res.json({ invites: result.rows });
  } catch (error) {
    console.error('Error fetching invites:', error);
    res.status(500).json({ error: 'Failed to fetch invites', details: error.message });
  }
});

// Create invite
router.post('/invites', requireSuperAdmin, async (req, res) => {
  try {
    const { email, is_super_admin, chain_id } = req.body;

    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check if email is already an admin
    const existingAdmin = await query(
      'SELECT user_id FROM admin_users WHERE LOWER(email) = $1',
      [normalizedEmail]
    );

    if (existingAdmin.rows.length > 0) {
      return res.status(400).json({ error: 'This email is already an admin' });
    }

    // Check if invite already exists
    const existingInvite = await query(
      'SELECT invite_id, accepted_at FROM admin_invites WHERE LOWER(email) = $1',
      [normalizedEmail]
    );

    if (existingInvite.rows.length > 0) {
      if (existingInvite.rows[0].accepted_at) {
        return res.status(400).json({ error: 'This invite has already been accepted' });
      }
      return res.status(400).json({ error: 'An invite for this email already exists' });
    }

    // Validate chain_id if not super admin
    if (!is_super_admin && chain_id) {
      const chainCheck = await query(
        'SELECT chain_id FROM chains WHERE chain_id = $1 AND is_active = true',
        [chain_id]
      );
      if (chainCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid or inactive chain' });
      }
    }

    const result = await query(
      `INSERT INTO admin_invites (email, is_super_admin, chain_id, invited_by)
       VALUES ($1, $2, $3, $4)
       RETURNING invite_id, email, is_super_admin, chain_id, created_at`,
      [normalizedEmail, is_super_admin || false, is_super_admin ? null : (chain_id || null), req.adminUser.user_id]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating invite:', error);
    res.status(500).json({ error: 'Failed to create invite', details: error.message });
  }
});

// Create invite AND send magic link email
router.post('/invites/send-link', requireSuperAdmin, async (req, res) => {
  try {
    const { email, is_super_admin, chain_id } = req.body;

    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check if email is already an admin
    const existingAdmin = await query(
      'SELECT user_id FROM admin_users WHERE LOWER(email) = $1',
      [normalizedEmail]
    );

    if (existingAdmin.rows.length > 0) {
      return res.status(400).json({ error: 'This email is already an admin' });
    }

    // Check if invite already exists
    const existingInvite = await query(
      'SELECT invite_id, accepted_at FROM admin_invites WHERE LOWER(email) = $1',
      [normalizedEmail]
    );

    let invite;
    if (existingInvite.rows.length > 0) {
      if (existingInvite.rows[0].accepted_at) {
        return res.status(400).json({ error: 'This invite has already been accepted' });
      }
      // Update existing invite (resend)
      const updateResult = await query(
        `UPDATE admin_invites
         SET is_super_admin = $1, chain_id = $2, created_at = CURRENT_TIMESTAMP
         WHERE invite_id = $3
         RETURNING invite_id, email, is_super_admin, chain_id, created_at`,
        [is_super_admin || false, is_super_admin ? null : (chain_id || null), existingInvite.rows[0].invite_id]
      );
      invite = updateResult.rows[0];
    } else {
      // Validate chain_id if not super admin
      if (!is_super_admin && chain_id) {
        const chainCheck = await query(
          'SELECT chain_id FROM chains WHERE chain_id = $1 AND is_active = true',
          [chain_id]
        );
        if (chainCheck.rows.length === 0) {
          return res.status(400).json({ error: 'Invalid or inactive chain' });
        }
      }

      // Create new invite
      const result = await query(
        `INSERT INTO admin_invites (email, is_super_admin, chain_id, invited_by)
         VALUES ($1, $2, $3, $4)
         RETURNING invite_id, email, is_super_admin, chain_id, created_at`,
        [normalizedEmail, is_super_admin || false, is_super_admin ? null : (chain_id || null), req.adminUser.user_id]
      );
      invite = result.rows[0];
    }

    // Configure email transporter
    const nodemailer = await import('nodemailer');
    let transporter;

    if (process.env.SMTP_HOST) {
      transporter = nodemailer.default.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD,
        },
      });
    } else {
      console.log('⚠️ SMTP not configured. Magic link will be logged to console.');
      transporter = nodemailer.default.createTransport({
        streamTransport: true,
        newline: 'unix',
        buffer: true,
      });
    }

    // Generate the invite URL
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const inviteUrl = `${frontendUrl}/admin-invite-callback?email=${encodeURIComponent(normalizedEmail)}`;

    const roleDescription = is_super_admin
      ? 'Super Admin (access to all chains)'
      : `Chain Admin`;

    const mailOptions = {
      from: process.env.EMAIL_FROM || 'noreply@aislegenius.com',
      to: normalizedEmail,
      subject: 'You have been invited to Aisle Genius Admin',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Admin Invitation</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0f172a;">
          <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #0f172a; padding: 40px 20px;">
            <tr>
              <td align="center">
                <table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 600px; background-color: #1e293b; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);">
                  <!-- Header -->
                  <tr>
                    <td style="padding: 40px 40px 20px; text-align: center;">
                      <div style="width: 64px; height: 64px; background: linear-gradient(135deg, #3b82f6, #2563eb); border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
                        <span style="font-size: 28px; line-height: 64px; display: block; text-align: center; width: 100%;">&#128722;</span>
                      </div>
                      <h1 style="color: #f1f5f9; font-size: 24px; margin: 0 0 8px;">You're Invited!</h1>
                      <p style="color: #94a3b8; font-size: 16px; margin: 0;">Welcome to Aisle Genius Admin Panel</p>
                    </td>
                  </tr>

                  <!-- Content -->
                  <tr>
                    <td style="padding: 20px 40px;">
                      <p style="color: #cbd5e1; font-size: 15px; line-height: 1.6; margin: 0 0 20px;">
                        You've been invited to join the Aisle Genius admin team as a <strong style="color: #60a5fa;">${roleDescription}</strong>.
                      </p>
                      <p style="color: #cbd5e1; font-size: 15px; line-height: 1.6; margin: 0 0 30px;">
                        Click the button below to activate your admin account.
                      </p>

                      <!-- CTA Button -->
                      <table cellpadding="0" cellspacing="0" border="0" width="100%">
                        <tr>
                          <td align="center">
                            <a href="${inviteUrl}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #3b82f6, #2563eb); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                              Activate Admin Access
                            </a>
                          </td>
                        </tr>
                      </table>

                      <p style="color: #64748b; font-size: 13px; margin: 30px 0 0; text-align: center;">
                        If the button doesn't work, copy and paste this link into your browser:
                      </p>
                      <p style="color: #3b82f6; font-size: 12px; word-break: break-all; margin: 8px 0 0; text-align: center;">
                        ${inviteUrl}
                      </p>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="padding: 20px 40px 40px; border-top: 1px solid #334155; margin-top: 30px;">
                      <p style="color: #64748b; font-size: 12px; margin: 0; text-align: center;">
                        This invitation was sent by ${req.adminUser.email}.<br>
                        If you didn't expect this email, you can safely ignore it.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
      text: `
You're Invited to Aisle Genius Admin!

You've been invited to join the Aisle Genius admin team as a ${roleDescription}.

Click the link below to activate your admin account:
${inviteUrl}

If you didn't expect this email, you can safely ignore it.

This invitation was sent by ${req.adminUser.email}.
      `,
    };

    const info = await transporter.sendMail(mailOptions);

    // Log for development if using stream transport
    if (info.message) {
      console.log('📧 Magic link email (dev mode):');
      console.log(`   To: ${normalizedEmail}`);
      console.log(`   Link: ${inviteUrl}`);
    }

    res.status(201).json({
      ...invite,
      message: 'Invitation email sent successfully'
    });
  } catch (error) {
    console.error('Error creating invite with magic link:', error);
    res.status(500).json({ error: 'Failed to send invitation', details: error.message });
  }
});

// Delete/cancel invite
router.delete('/invites/:id', requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      'DELETE FROM admin_invites WHERE invite_id = $1 AND accepted_at IS NULL RETURNING invite_id, email',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Invite not found or already accepted' });
    }

    res.json({
      success: true,
      message: 'Invite has been cancelled',
      invite: result.rows[0]
    });
  } catch (error) {
    console.error('Error deleting invite:', error);
    res.status(500).json({ error: 'Failed to delete invite', details: error.message });
  }
});

export default router;
