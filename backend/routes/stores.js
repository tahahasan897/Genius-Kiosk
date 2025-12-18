import express from 'express';
import { query } from '../db.js';

const router = express.Router();

// Get all chains
router.get('/chains', async (req, res) => {
  try {
    const result = await query(
      `SELECT c.*, COUNT(s.store_id) as store_count
       FROM chains c
       LEFT JOIN stores s ON c.chain_id = s.chain_id AND s.is_active = true
       GROUP BY c.chain_id
       ORDER BY c.chain_name`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching chains:', error);
    res.status(500).json({ error: 'Failed to fetch chains' });
  }
});

// Get all stores (with chain info)
router.get('/', async (req, res) => {
  try {
    const result = await query(
      `SELECT s.*, c.chain_name
       FROM stores s
       LEFT JOIN chains c ON s.chain_id = c.chain_id
       WHERE s.is_active = true
       ORDER BY c.chain_name, s.store_name`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching stores:', error);
    res.status(500).json({ error: 'Failed to fetch stores' });
  }
});

// Get stores by chain ID
router.get('/chain/:chainId', async (req, res) => {
  try {
    const { chainId } = req.params;
    const result = await query(
      `SELECT s.*, c.chain_name
       FROM stores s
       LEFT JOIN chains c ON s.chain_id = c.chain_id
       WHERE s.chain_id = $1 AND s.is_active = true
       ORDER BY s.store_name`,
      [chainId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching stores by chain:', error);
    res.status(500).json({ error: 'Failed to fetch stores' });
  }
});

// Get store by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
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

