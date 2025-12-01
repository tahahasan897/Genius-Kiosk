import express from 'express';
import { query } from '../db.js';

const router = express.Router();

// Get all stores
router.get('/', async (req, res) => {
  try {
    const result = await query('SELECT * FROM stores ORDER BY store_name');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching stores:', error);
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

