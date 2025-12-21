import express from 'express';
import { query } from '../db.js';
import { requireAdmin, canAccessChain, canAccessStore } from '../middleware/auth.js';

const router = express.Router();

// Get all chains (filtered by admin's chain_ids)
router.get('/chains', requireAdmin, async (req, res) => {
  try {
    const { is_super_admin, chain_ids } = req.adminUser;

    let result;
    if (is_super_admin) {
      // Super admins see all chains
      result = await query(
        `SELECT c.*, COUNT(s.store_id) as store_count
         FROM chains c
         LEFT JOIN stores s ON c.chain_id = s.chain_id AND s.is_active = true
         GROUP BY c.chain_id
         ORDER BY c.chain_name`
      );
    } else {
      // Chain admins only see their assigned chains
      if (!chain_ids || chain_ids.length === 0) {
        return res.json([]);
      }
      result = await query(
        `SELECT c.*, COUNT(s.store_id) as store_count
         FROM chains c
         LEFT JOIN stores s ON c.chain_id = s.chain_id AND s.is_active = true
         WHERE c.chain_id = ANY($1)
         GROUP BY c.chain_id
         ORDER BY c.chain_name`,
        [chain_ids]
      );
    }
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching chains:', error);
    res.status(500).json({ error: 'Failed to fetch chains' });
  }
});

// Get all stores (filtered by admin's chain_ids)
router.get('/', requireAdmin, async (req, res) => {
  try {
    const { is_super_admin, chain_ids } = req.adminUser;

    let result;
    if (is_super_admin) {
      // Super admins see all stores
      result = await query(
        `SELECT s.*, c.chain_name
         FROM stores s
         LEFT JOIN chains c ON s.chain_id = c.chain_id
         WHERE s.is_active = true
         ORDER BY c.chain_name, s.store_name`
      );
    } else {
      // Chain admins only see stores in their assigned chains
      if (!chain_ids || chain_ids.length === 0) {
        return res.json([]);
      }
      result = await query(
        `SELECT s.*, c.chain_name
         FROM stores s
         LEFT JOIN chains c ON s.chain_id = c.chain_id
         WHERE s.is_active = true AND s.chain_id = ANY($1)
         ORDER BY c.chain_name, s.store_name`,
        [chain_ids]
      );
    }
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching stores:', error);
    res.status(500).json({ error: 'Failed to fetch stores' });
  }
});

// Get stores by chain ID (with access check)
router.get('/chain/:chainId', requireAdmin, async (req, res) => {
  try {
    const { chainId } = req.params;
    const chainIdInt = parseInt(chainId);

    // Verify admin has access to this chain
    if (!canAccessChain(req.adminUser, chainIdInt)) {
      return res.status(403).json({ error: 'Access denied. You do not have access to this chain.' });
    }

    const result = await query(
      `SELECT s.*, c.chain_name
       FROM stores s
       LEFT JOIN chains c ON s.chain_id = c.chain_id
       WHERE s.chain_id = $1 AND s.is_active = true
       ORDER BY s.store_name`,
      [chainIdInt]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching stores by chain:', error);
    res.status(500).json({ error: 'Failed to fetch stores' });
  }
});

// Get store by ID (with access check)
router.get('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Verify admin has access to this store
    const hasAccess = await canAccessStore(req.adminUser, id);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied. You do not have access to this store.' });
    }

    const result = await query('SELECT * FROM stores WHERE store_id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Store not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching store:', error);
    res.status(500).json({ error: 'Failed to fetch store' });
  }
});

export default router;

