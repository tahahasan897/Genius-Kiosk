import express from 'express';
import { query } from '../db.js';

const router = express.Router();

// Search products with fuzzy matching
router.get('/search', async (req, res) => {
  try {
    const { q, storeId } = req.query;

    if (!q) {
      return res.status(400).json({ error: 'Search query (q) is required' });
    }

    const storeIdParam = storeId ? parseInt(storeId) : 1; // Default to store 1

    // Filter by chain_id (get it from the store)
    const storeResult = await query(
      'SELECT chain_id FROM stores WHERE store_id = $1',
      [storeIdParam]
    );

    if (storeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Store not found' });
    }

    const chainId = storeResult.rows[0].chain_id;
    const searchTerm = q.trim().toLowerCase();

    // Split into words for multi-word search support
    const words = searchTerm.split(/\s+/).filter(w => w.length > 0);

    // Build SQL with fuzzy matching using PostgreSQL trigrams
    // Note: Requires pg_trgm extension (run: CREATE EXTENSION IF NOT EXISTS pg_trgm;)
    const sql = `
      SELECT 
        p.product_id as id,
        p.sku,
        p.product_name as name,
        p.category,
        p.base_price as price,
        si.aisle as aisle,
        si.shelf_position as shelf,
        p.image_url,
        p.description,
        p.base_price as current_price,
        COALESCE(si.is_available, true) as in_stock,
        COALESCE(si.stock_quantity, 0) as stock_quantity,
        -- Calculate comprehensive relevance score
        (
          -- Exact match gets highest score
          CASE WHEN LOWER(p.product_name) = $1 THEN 1000 ELSE 0 END +
          CASE WHEN LOWER(p.sku) = $1 THEN 900 ELSE 0 END +
          
          -- Starts with match
          CASE WHEN LOWER(p.product_name) LIKE $1 || '%' THEN 800 ELSE 0 END +
          
          -- Trigram similarity (fuzzy matching) - scaled to 0-700
          (similarity(LOWER(p.product_name), $1) * 700) +
          (similarity(LOWER(p.sku), $1) * 600) +
          
          -- Contains match
          CASE WHEN LOWER(p.product_name) LIKE '%' || $1 || '%' THEN 400 ELSE 0 END +
          
          -- Category and description matches (lower priority)
          CASE WHEN LOWER(p.category) LIKE '%' || $1 || '%' THEN 200 ELSE 0 END +
          (similarity(LOWER(p.description), $1) * 100) +
          
          -- Individual word matching for multi-word queries
          ${words.length > 1 ? words.map((_, i) => `
            (similarity(LOWER(p.product_name), $${6 + i}) * 300) +
            CASE WHEN LOWER(p.product_name) LIKE '%' || $${6 + i} || '%' THEN 250 ELSE 0 END
          `).join(' +') : '0'}
        ) as relevance_score
      FROM products p
      LEFT JOIN store_inventory si ON p.product_id = si.product_id AND si.store_id = $2
      WHERE p.chain_id = $3
      AND (
        -- Exact and partial matches
        LOWER(p.product_name) = $1
        OR LOWER(p.sku) = $1
        OR LOWER(p.product_name) LIKE '%' || $1 || '%'
        OR LOWER(p.sku) LIKE '%' || $1 || '%'
        OR LOWER(p.category) LIKE '%' || $1 || '%'
        OR LOWER(p.description) LIKE '%' || $1 || '%'
        
        -- Fuzzy matching with trigrams (handles misspellings)
        -- The % operator checks if similarity is above threshold (default 0.3)
        OR LOWER(p.product_name) % $1
        OR LOWER(p.sku) % $1
        OR similarity(LOWER(p.product_name), $1) > $4  -- Configurable threshold
        OR similarity(LOWER(p.sku), $1) > $4
        OR similarity(LOWER(p.description), $1) > $5   -- Lower threshold for description
        
        -- Multi-word search support
        ${words.length > 1 ? words.map((_, i) => `
          OR LOWER(p.product_name) % $${6 + i}
          OR similarity(LOWER(p.product_name), $${6 + i}) > $4
          OR LOWER(p.product_name) LIKE '%' || $${6 + i} || '%'
        `).join('') : ''}
      )
      ORDER BY relevance_score DESC, p.product_name ASC
      LIMIT 50
    `;

    // Build parameters array
    const params = [
      searchTerm,        // $1: search term
      storeIdParam,      // $2: store_id
      chainId,           // $3: chain_id
      0.2,               // $4: similarity threshold for name/sku (lower = more fuzzy)
      0.15,              // $5: similarity threshold for description (even more fuzzy)
    ];

    // Add individual words for multi-word search
    if (words.length > 1) {
      words.forEach(word => {
        params.push(word);
      });
    }

    // Debug logging
    console.log('Search term:', searchTerm);
    console.log('Words:', words);

    const result = await query(sql, params);

    // Map backend response to frontend Product interface
    const products = result.rows.map(row => {
      const stockQuantity = parseInt(row.stock_quantity) || 0;
      const isAvailable = row.in_stock !== false;

      // Determine stock status based on availability and quantity
      let stockStatus = 'out-of-stock';
      if (isAvailable && stockQuantity > 0) {
        stockStatus = stockQuantity < 10 ? 'low-stock' : 'in-stock';
      }

      return {
        id: row.id.toString(),
        name: row.name,
        category: row.category || '',
        price: parseFloat(row.price) || 0,
        aisle: row.aisle || 0,  // Keep as-is from store_inventory
        shelf: row.shelf || '',
        stockLevel: stockQuantity,
        stockStatus: stockStatus,
        image: row.image_url || '',
        description: row.description || '',
        mapX: 50,
        mapY: 50,
      };
    });

    console.log(`Found ${products.length} products`);

    res.json(products);
  } catch (error) {
    console.error('Error searching products:', error);
    console.error('Error details:', error.message);
    console.error('Error stack:', error.stack);

    // If pg_trgm extension is not installed, provide helpful error
    if (error.message.includes('similarity') || error.message.includes('pg_trgm')) {
      return res.status(500).json({
        error: 'Search functionality requires pg_trgm extension. Please run: CREATE EXTENSION IF NOT EXISTS pg_trgm;',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }

    res.status(500).json({
      error: 'Failed to search products',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get all products (with pagination)
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20, category, storeId } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const storeIdParam = storeId ? parseInt(storeId) : 1;

    const params = [];
    const conditions = [];

    // Get chain_id from store
    const storeResult = await query(
      'SELECT chain_id FROM stores WHERE store_id = $1',
      [storeIdParam]
    );

    if (storeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Store not found' });
    }

    const chainId = storeResult.rows[0].chain_id;

    // Build query with store_inventory JOIN - get aisle as-is
    let sql = `
      SELECT 
        p.product_id as id,
        p.sku,
        p.product_name as name,
        p.category,
        p.base_price as price,
        si.aisle as aisle,
        si.shelf_position as shelf,
        p.image_url,
        p.description,
        p.base_price as current_price,
        COALESCE(si.is_available, true) as in_stock,
        COALESCE(si.stock_quantity, 0) as stock_quantity
      FROM products p
      LEFT JOIN store_inventory si ON p.product_id = si.product_id AND si.store_id = $1
    `;

    params.push(storeIdParam);

    // Filter by chain_id
    params.push(chainId);
    const chainParamIndex = params.length;
    conditions.push(`p.chain_id = $${chainParamIndex}`);

    if (category) {
      params.push(category);
      const categoryParamIndex = params.length;
      conditions.push(`p.category = $${categoryParamIndex}`);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    params.push(parseInt(limit), offset);
    const limitParamIndex = params.length - 1;
    const offsetParamIndex = params.length;
    sql += ` ORDER BY p.product_name LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}`;

    const result = await query(sql, params);

    // Map backend response - keep aisle as-is
    const products = result.rows.map(row => {
      const stockQuantity = parseInt(row.stock_quantity) || 0;
      const isAvailable = row.in_stock !== false;

      let stockStatus = 'out-of-stock';
      if (isAvailable && stockQuantity > 0) {
        stockStatus = stockQuantity < 10 ? 'low-stock' : 'in-stock';
      }

      return {
        id: row.id.toString(),
        name: row.name,
        category: row.category || '',
        price: parseFloat(row.price) || 0,
        aisle: row.aisle || 0,  // Keep as-is from store_inventory
        shelf: row.shelf || '',
        stockLevel: stockQuantity,
        stockStatus: stockStatus,
        image: row.image_url || '',
        description: row.description || '',
        mapX: 50,
        mapY: 50,
      };
    });

    res.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

export default router;