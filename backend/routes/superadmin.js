import express from 'express';
import pool, { query } from '../db.js';

const router = express.Router();

// ============================================
// MIDDLEWARE: Require Admin (any admin - super or chain)
// ============================================

const requireAdmin = async (req, res, next) => {
  try {
    const firebaseUid = req.headers['x-firebase-uid'];

    if (!firebaseUid) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check if user exists in admin_users and get their chain assignments
    const result = await query(
      `SELECT au.user_id, au.email, au.display_name, au.is_super_admin, au.chain_id,
              COALESCE(array_agg(aca.chain_id) FILTER (WHERE aca.chain_id IS NOT NULL), '{}') as chain_ids
       FROM admin_users au
       LEFT JOIN admin_chain_assignments aca ON au.user_id = aca.user_id
       WHERE au.firebase_uid = $1
       GROUP BY au.user_id, au.email, au.display_name, au.is_super_admin, au.chain_id`,
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

// ============================================
// MIDDLEWARE: Require Super Admin (for admin management only)
// ============================================

const requireSuperAdmin = async (req, res, next) => {
  try {
    const firebaseUid = req.headers['x-firebase-uid'];

    if (!firebaseUid) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check if user exists in admin_users and is a super admin
    const result = await query(
      'SELECT user_id, email, display_name, is_super_admin, chain_id FROM admin_users WHERE firebase_uid = $1',
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

    console.log('📋 /me endpoint called:');
    console.log('   Firebase UID:', firebaseUid ? firebaseUid.substring(0, 10) + '...' : 'none');
    console.log('   Email:', userEmail || 'none');

    if (!firebaseUid) {
      console.log('   ❌ No Firebase UID provided');
      return res.json({ isAdmin: false, isSuperAdmin: false });
    }

    // Check if user already exists as admin (by firebase_uid first, then by email)
    // Include role column (defaults based on is_super_admin for backwards compatibility)
    let existingAdmin = await query(
      `SELECT au.user_id, au.email, au.display_name, au.is_super_admin, au.chain_id, au.firebase_uid,
              COALESCE(au.role, CASE WHEN au.is_super_admin THEN 'super_admin' ELSE 'store_admin' END) as role,
              COALESCE(array_agg(aca.chain_id) FILTER (WHERE aca.chain_id IS NOT NULL), '{}') as chain_ids
       FROM admin_users au
       LEFT JOIN admin_chain_assignments aca ON au.user_id = aca.user_id
       WHERE au.firebase_uid = $1
       GROUP BY au.user_id, au.email, au.display_name, au.is_super_admin, au.chain_id, au.firebase_uid, au.role`,
      [firebaseUid]
    );

    // If not found by firebase_uid, check by email (user might be signing in with different method)
    if (existingAdmin.rows.length === 0 && userEmail) {
      existingAdmin = await query(
        `SELECT au.user_id, au.email, au.display_name, au.is_super_admin, au.chain_id, au.firebase_uid,
                COALESCE(au.role, CASE WHEN au.is_super_admin THEN 'super_admin' ELSE 'store_admin' END) as role,
                COALESCE(array_agg(aca.chain_id) FILTER (WHERE aca.chain_id IS NOT NULL), '{}') as chain_ids
         FROM admin_users au
         LEFT JOIN admin_chain_assignments aca ON au.user_id = aca.user_id
         WHERE LOWER(au.email) = LOWER($1)
         GROUP BY au.user_id, au.email, au.display_name, au.is_super_admin, au.chain_id, au.firebase_uid, au.role`,
        [userEmail]
      );

      // If found by email, update the firebase_uid to the current one
      if (existingAdmin.rows.length > 0) {
        console.log(`   🔄 Admin found by email, updating firebase_uid...`);
        await query(
          'UPDATE admin_users SET firebase_uid = $1 WHERE user_id = $2',
          [firebaseUid, existingAdmin.rows[0].user_id]
        );
      }
    }

    if (existingAdmin.rows.length > 0) {
      const adminUser = existingAdmin.rows[0];
      // Determine if user can access the team page based on role
      const canAccessTeam = adminUser.role === 'super_admin' || adminUser.role === 'team_admin';
      console.log(`   ✅ Existing admin found: ${adminUser.email} (super: ${adminUser.is_super_admin}, role: ${adminUser.role}, chains: ${adminUser.chain_ids})`);
      return res.json({
        isAdmin: true,
        isSuperAdmin: adminUser.is_super_admin,
        isTeamAdmin: canAccessTeam, // Can access /team page
        role: adminUser.role, // 'super_admin', 'team_admin', or 'store_admin'
        userId: adminUser.user_id,
        email: adminUser.email,
        displayName: adminUser.display_name,
        chainId: adminUser.chain_id, // Legacy single chain
        chainIds: adminUser.chain_ids || [] // New multi-chain array
      });
    }

    console.log('   ℹ️ No existing admin record found');

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
          console.log(`   ✅ Bootstrap: Created first super admin for ${userEmail}`);
          return res.json({
            isAdmin: true,
            isSuperAdmin: true,
            userId: newAdmin.rows[0].user_id,
            email: newAdmin.rows[0].email,
            displayName: newAdmin.rows[0].display_name,
            chainId: null,
            chainIds: [],
            bootstrapped: true
          });
        }
      }

      // INVITE: Check if there's a pending invite for this email
      console.log(`   🔍 Checking for pending invite for: ${userEmail}`);
      const invite = await query(
        `SELECT invite_id, email, is_super_admin, chain_id,
                COALESCE(chain_ids, CASE WHEN chain_id IS NOT NULL THEN ARRAY[chain_id] ELSE '{}' END) as chain_ids
         FROM admin_invites
         WHERE LOWER(email) = LOWER($1) AND accepted_at IS NULL`,
        [userEmail]
      );

      console.log(`   📧 Found ${invite.rows.length} pending invite(s)`);

      if (invite.rows.length > 0) {
        const pendingInvite = invite.rows[0];
        const chainIds = pendingInvite.chain_ids || [];
        console.log(`   ✅ Found pending invite: ${pendingInvite.email} (super: ${pendingInvite.is_super_admin}, chains: ${chainIds})`);

        // Create the admin user from the invite (use ON CONFLICT to handle race conditions)
        await query(
          `INSERT INTO admin_users (firebase_uid, email, display_name, is_super_admin, chain_id)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (firebase_uid) DO NOTHING`,
          [firebaseUid, userEmail, null, pendingInvite.is_super_admin, chainIds[0] || null]
        );

        // Fetch the admin user (either just created or already existed)
        const newAdminResult = await query(
          'SELECT user_id, email, display_name, is_super_admin, chain_id FROM admin_users WHERE firebase_uid = $1',
          [firebaseUid]
        );

        if (newAdminResult.rows.length === 0) {
          console.log('   ❌ Failed to create or find admin user');
          return res.status(500).json({ error: 'Failed to create admin user' });
        }

        const newAdmin = newAdminResult.rows[0];

        // Create chain assignments for all chains (ON CONFLICT handles duplicates)
        if (chainIds.length > 0) {
          for (const chainId of chainIds) {
            await query(
              'INSERT INTO admin_chain_assignments (user_id, chain_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
              [newAdmin.user_id, chainId]
            );
          }
        }

        // Mark invite as accepted (only if not already accepted)
        await query(
          'UPDATE admin_invites SET accepted_at = CURRENT_TIMESTAMP WHERE invite_id = $1 AND accepted_at IS NULL',
          [pendingInvite.invite_id]
        );

        console.log(`   🎉 Invite accepted: ${userEmail} is now an admin (super: ${newAdmin.is_super_admin}, chains: ${chainIds})`);
        return res.json({
          isAdmin: true,
          isSuperAdmin: newAdmin.is_super_admin,
          userId: newAdmin.user_id,
          email: newAdmin.email,
          displayName: newAdmin.display_name,
          chainId: newAdmin.chain_id,
          chainIds: chainIds,
          inviteAccepted: true
        });
      } else {
        console.log(`   ⚠️ No pending invite found for ${userEmail}`);
      }
    } else {
      console.log('   ⚠️ No email header provided, cannot check for invites');
    }

    // No admin record, no bootstrap, no invite
    console.log('   ❌ User is not an admin');
    return res.json({ isAdmin: false, isSuperAdmin: false });
  } catch (error) {
    console.error('Error checking admin status:', error);
    res.status(500).json({ error: 'Failed to check admin status' });
  }
});

// ============================================
// DASHBOARD
// ============================================

router.get('/dashboard', requireAdmin, async (req, res) => {
  try {
    const { is_super_admin, chain_id, chain_ids } = req.adminUser;

    // Chain admins only see their assigned chains' data
    let chainFilter = '';
    let storeChainFilter = '';
    let productChainFilter = '';
    let params = [];

    if (!is_super_admin && chain_ids && chain_ids.length > 0) {
      params = [chain_ids];
      chainFilter = 'AND c.chain_id = ANY($1)';
      storeChainFilter = 'AND s.chain_id = ANY($1)';
      productChainFilter = 'AND p.chain_id = ANY($1)';
    }

    // Get chains count (for chain admin, this will be 1)
    const chainsResult = await query(
      `SELECT COUNT(*) FROM chains c WHERE is_active = true ${chainFilter}`,
      params
    );
    const totalChains = parseInt(chainsResult.rows[0].count);

    // Get stores count
    const storesResult = await query(
      `SELECT COUNT(*) FROM stores s WHERE is_active = true ${storeChainFilter}`,
      params
    );
    const totalStores = parseInt(storesResult.rows[0].count);

    // Get products count
    const productsResult = await query(
      `SELECT COUNT(*) FROM products p WHERE 1=1 ${productChainFilter}`,
      params
    );
    const totalProducts = parseInt(productsResult.rows[0].count);

    // Get admin users count (only super admins see this)
    let totalAdmins = 0;
    if (is_super_admin) {
      const adminsResult = await query('SELECT COUNT(*) FROM admin_users');
      totalAdmins = parseInt(adminsResult.rows[0].count);
    }

    // Get recently created chains
    const recentChainsResult = await query(
      `SELECT chain_id, chain_name, created_at
       FROM chains c
       WHERE is_active = true ${chainFilter}
       ORDER BY created_at DESC
       LIMIT 5`,
      params
    );

    // Get recently created stores
    const recentStoresResult = await query(
      `SELECT s.store_id, s.store_name, s.created_at, c.chain_name
       FROM stores s
       JOIN chains c ON s.chain_id = c.chain_id
       WHERE s.is_active = true ${storeChainFilter}
       ORDER BY s.created_at DESC
       LIMIT 5`,
      params
    );

    // Get chains with store counts
    const chainStoreCountsResult = await query(
      `SELECT c.chain_id, c.chain_name, COUNT(s.store_id) as store_count
       FROM chains c
       LEFT JOIN stores s ON c.chain_id = s.chain_id AND s.is_active = true
       WHERE c.is_active = true ${chainFilter}
       GROUP BY c.chain_id, c.chain_name
       ORDER BY store_count DESC
       LIMIT 5`,
      params
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
      topChains: chainStoreCountsResult.rows,
      // Include admin info for frontend to adapt UI
      adminInfo: {
        isSuperAdmin: is_super_admin,
        chainId: chain_id
      }
    });
  } catch (error) {
    console.error('Error fetching admin dashboard:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data', details: error.message });
  }
});

// ============================================
// CHAINS CRUD
// ============================================

// Get all chains with stats (chain admins only see their assigned chains)
router.get('/chains', requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 50, search = '', includeInactive = 'false' } = req.query;
    const { is_super_admin, chain_ids: adminChainIds } = req.adminUser;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const params = [];
    const conditions = [];

    // Chain admins can only see their assigned chains
    if (!is_super_admin && adminChainIds && adminChainIds.length > 0) {
      params.push(adminChainIds);
      conditions.push(`c.chain_id = ANY($${params.length})`);
    }

    // When includeInactive is true, show ONLY inactive items
    // When false (default), show only active items
    if (includeInactive === 'true') {
      conditions.push('c.is_active = false');
    } else {
      conditions.push('c.is_active = true');
    }

    if (search) {
      params.push(`%${search.toLowerCase()}%`);
      conditions.push(`LOWER(c.chain_name) LIKE $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

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

    // Get total count with same filters
    const countParams = [];
    const countConditions = [];

    if (!is_super_admin && adminChainIds && adminChainIds.length > 0) {
      countParams.push(adminChainIds);
      countConditions.push(`chain_id = ANY($${countParams.length})`);
    }

    // Match the same logic as above
    if (includeInactive === 'true') {
      countConditions.push('is_active = false');
    } else {
      countConditions.push('is_active = true');
    }

    if (search) {
      countParams.push(`%${search.toLowerCase()}%`);
      countConditions.push(`LOWER(chain_name) LIKE $${countParams.length}`);
    }

    const countWhere = countConditions.length > 0 ? `WHERE ${countConditions.join(' AND ')}` : '';

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

// Get single chain (chain admins can only view their chain)
router.get('/chains/:id', requireAdmin, async (req, res) => {
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

// Get stores (chain admins only see stores in their assigned chains)
router.get('/stores', requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 50, search = '', chainId, includeInactive = 'false' } = req.query;
    const { is_super_admin, chain_ids: adminChainIds } = req.adminUser;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const params = [];
    const conditions = [];

    // Chain admins can only see stores in their assigned chains
    if (!is_super_admin && adminChainIds && adminChainIds.length > 0) {
      params.push(adminChainIds);
      conditions.push(`s.chain_id = ANY($${params.length})`);

      // If chainId filter is provided, it must be one of the admin's chains
      if (chainId) {
        params.push(parseInt(chainId));
        conditions.push(`s.chain_id = $${params.length}`);
      }
    } else if (chainId) {
      // Super admins can filter by any chain
      params.push(parseInt(chainId));
      conditions.push(`s.chain_id = $${params.length}`);
    }

    // When includeInactive is true, show ONLY inactive items
    // When false (default), show only active items
    if (includeInactive === 'true') {
      conditions.push('s.is_active = false');
    } else {
      conditions.push('s.is_active = true');
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

    // Get total count with same filters
    const countConditions = [];
    const countParams = [];

    if (!is_super_admin && adminChainIds && adminChainIds.length > 0) {
      countParams.push(adminChainIds);
      countConditions.push(`chain_id = ANY($${countParams.length})`);

      if (chainId) {
        countParams.push(parseInt(chainId));
        countConditions.push(`chain_id = $${countParams.length}`);
      }
    } else if (chainId) {
      countParams.push(parseInt(chainId));
      countConditions.push(`chain_id = $${countParams.length}`);
    }

    // Match the same logic as above
    if (includeInactive === 'true') {
      countConditions.push('is_active = false');
    } else {
      countConditions.push('is_active = true');
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

// Get stores by chain ID (chain admins can only access their chain)
router.get('/chains/:chainId/stores', requireAdmin, async (req, res) => {
  try {
    const { chainId } = req.params;
    const { includeInactive = 'false' } = req.query;
    const { is_super_admin, chain_id: adminChainId } = req.adminUser;

    // Chain admins can only access their own chain
    if (!is_super_admin && adminChainId && parseInt(chainId) !== adminChainId) {
      return res.status(403).json({ error: 'Access denied. You can only view stores in your assigned chain.' });
    }

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

// Get single store (chain admins can only access stores in their chain)
router.get('/stores/:id', requireAdmin, async (req, res) => {
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

// Get all admin users (with multi-chain support)
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
        c.chain_name,
        COALESCE(
          (SELECT array_agg(aca.chain_id) FROM admin_chain_assignments aca WHERE aca.user_id = au.user_id),
          '{}'
        ) as chain_ids,
        COALESCE(
          (SELECT array_agg(ch.chain_name) FROM admin_chain_assignments aca2
           JOIN chains ch ON aca2.chain_id = ch.chain_id
           WHERE aca2.user_id = au.user_id),
          '{}'
        ) as chain_names
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

// Update admin user (with multi-chain support)
router.put('/admins/:id', requireSuperAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { display_name, is_super_admin, chain_id, chain_ids } = req.body;

    await client.query('BEGIN');

    // Support both chain_id (legacy) and chain_ids (new)
    let chainIdsArray = chain_ids || [];
    if (chain_id && !chainIdsArray.includes(chain_id)) {
      chainIdsArray = [chain_id, ...chainIdsArray];
    }

    // Clear chain assignments for super admins
    if (is_super_admin) {
      chainIdsArray = [];
    }

    // Validate chain_ids if not super admin
    if (!is_super_admin && chainIdsArray.length > 0) {
      const chainCheck = await client.query(
        'SELECT chain_id FROM chains WHERE chain_id = ANY($1) AND is_active = true',
        [chainIdsArray]
      );
      if (chainCheck.rows.length !== chainIdsArray.length) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'One or more invalid or inactive chains' });
      }
    }

    // Update the admin user
    const result = await client.query(
      `UPDATE admin_users
       SET display_name = $1, is_super_admin = $2, chain_id = $3
       WHERE user_id = $4
       RETURNING user_id, firebase_uid, email, display_name, is_super_admin, chain_id, created_at`,
      [display_name || null, is_super_admin || false, chainIdsArray[0] || null, id]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Admin user not found' });
    }

    // Update chain assignments - delete existing and insert new
    await client.query(
      'DELETE FROM admin_chain_assignments WHERE user_id = $1',
      [id]
    );

    if (chainIdsArray.length > 0) {
      for (const chainId of chainIdsArray) {
        await client.query(
          'INSERT INTO admin_chain_assignments (user_id, chain_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [id, chainId]
        );
      }
    }

    await client.query('COMMIT');

    // Return the updated admin with chain info
    const adminResult = await query(
      `SELECT
        au.user_id,
        au.firebase_uid,
        au.email,
        au.display_name,
        au.is_super_admin,
        au.chain_id,
        au.created_at,
        COALESCE(
          (SELECT array_agg(aca.chain_id) FROM admin_chain_assignments aca WHERE aca.user_id = au.user_id),
          '{}'
        ) as chain_ids,
        COALESCE(
          (SELECT array_agg(ch.chain_name) FROM admin_chain_assignments aca2
           JOIN chains ch ON aca2.chain_id = ch.chain_id
           WHERE aca2.user_id = au.user_id),
          '{}'
        ) as chain_names
       FROM admin_users au
       WHERE au.user_id = $1`,
      [id]
    );

    res.json(adminResult.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating admin user:', error);
    res.status(500).json({ error: 'Failed to update admin user', details: error.message });
  } finally {
    client.release();
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

// Create invite (supports multiple chain assignments and role)
router.post('/invites', requireSuperAdmin, async (req, res) => {
  try {
    const { email, is_super_admin, role, chain_id, chain_ids } = req.body;

    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Determine the role - use provided role or derive from is_super_admin
    const validRoles = ['super_admin', 'team_admin', 'store_admin'];
    let finalRole = role;
    if (!finalRole || !validRoles.includes(finalRole)) {
      // Fallback to is_super_admin for backwards compatibility
      finalRole = is_super_admin ? 'super_admin' : 'store_admin';
    }
    const isSuperAdmin = finalRole === 'super_admin';

    // Support both chain_id (legacy) and chain_ids (new)
    let chainIdsArray = chain_ids || [];
    if (chain_id && !chainIdsArray.includes(chain_id)) {
      chainIdsArray = [chain_id, ...chainIdsArray];
    }

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

    // Validate chain_ids if not super admin
    if (!isSuperAdmin && chainIdsArray.length > 0) {
      const chainCheck = await query(
        'SELECT chain_id FROM chains WHERE chain_id = ANY($1) AND is_active = true',
        [chainIdsArray]
      );
      if (chainCheck.rows.length !== chainIdsArray.length) {
        return res.status(400).json({ error: 'One or more invalid or inactive chains' });
      }
    }

    // Insert invite with role column (will use default if column doesn't exist yet)
    const result = await query(
      `INSERT INTO admin_invites (email, is_super_admin, role, chain_id, chain_ids, invited_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING invite_id, email, is_super_admin, role, chain_id, chain_ids, created_at`,
      [
        normalizedEmail,
        isSuperAdmin,
        finalRole,
        isSuperAdmin ? null : (chainIdsArray[0] || null), // Legacy single chain
        isSuperAdmin ? '{}' : chainIdsArray, // New multi-chain array
        req.adminUser.user_id
      ]
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
