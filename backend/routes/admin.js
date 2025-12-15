import express from 'express';
import multer from 'multer';
import csv from 'csv-parser';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool, { query } from '../db.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================
// DASHBOARD ENDPOINT
// ============================================

router.get('/dashboard', async (req, res) => {
  try {
    const { storeId = 1 } = req.query;
    const storeIdParam = parseInt(storeId);

    // Get total products count
    const totalProductsResult = await query('SELECT COUNT(*) FROM products');
    const totalProducts = parseInt(totalProductsResult.rows[0].count);

    // Get linked products count (products with map links)
    const linkedProductsResult = await query(
      `SELECT COUNT(DISTINCT product_id) FROM product_map_links WHERE store_id = $1`,
      [storeIdParam]
    );
    const linkedProducts = parseInt(linkedProductsResult.rows[0].count);

    // Get low stock count (stock < 10)
    const lowStockResult = await query(
      `SELECT COUNT(*) FROM store_inventory WHERE store_id = $1 AND stock_quantity > 0 AND stock_quantity < 10`,
      [storeIdParam]
    );
    const lowStockCount = parseInt(lowStockResult.rows[0].count);

    // Get out of stock count
    const outOfStockResult = await query(
      `SELECT COUNT(*) FROM store_inventory WHERE store_id = $1 AND (stock_quantity = 0 OR is_available = false)`,
      [storeIdParam]
    );
    const outOfStockCount = parseInt(outOfStockResult.rows[0].count);

    // Get products missing images
    const missingImagesResult = await query(
      `SELECT COUNT(*) FROM products WHERE image_url IS NULL OR image_url = ''`
    );
    const missingImagesCount = parseInt(missingImagesResult.rows[0].count);

    // Get products missing location data
    const missingLocationResult = await query(
      `SELECT COUNT(*) FROM products p
       LEFT JOIN store_inventory si ON p.product_id = si.product_id AND si.store_id = $1
       WHERE si.aisle IS NULL OR si.aisle = ''`,
      [storeIdParam]
    );
    const missingLocationCount = parseInt(missingLocationResult.rows[0].count);

    // Get map status
    const mapStatusResult = await query(
      `SELECT map_has_draft_changes, map_published_at FROM stores WHERE store_id = $1`,
      [storeIdParam]
    );
    const mapStatus = mapStatusResult.rows[0] || {};
    const mapHasDraftChanges = mapStatus.map_has_draft_changes || false;
    const mapIsPublished = !!mapStatus.map_published_at;
    const lastPublishedAt = mapStatus.map_published_at;

    // Get map elements count (for getting started)
    const mapElementsResult = await query(
      `SELECT COUNT(*) FROM store_map_elements WHERE store_id = $1`,
      [storeIdParam]
    );
    const mapElementsCount = parseInt(mapElementsResult.rows[0].count);

    // Build Getting Started steps
    const gettingStartedSteps = [
      {
        id: 'create-element',
        title: 'Create your first map element',
        description: 'Add a pin, shape, or text to your store map',
        completed: mapElementsCount > 0,
        action: 'map',
      },
      {
        id: 'import-products',
        title: 'Import products via CSV',
        description: 'Bulk import your product catalog',
        completed: totalProducts > 0,
        action: 'import',
      },
      {
        id: 'link-products',
        title: 'Link products to map pins',
        description: 'Connect products to locations on your map',
        completed: linkedProducts > 0,
        action: 'map',
      },
      {
        id: 'preview-map',
        title: 'Preview your kiosk map',
        description: 'See how customers will view your store',
        completed: false, // Tracked client-side via localStorage
        action: 'preview',
      },
      {
        id: 'publish-map',
        title: 'Publish the map to go live',
        description: 'Make your map visible to customers',
        completed: mapIsPublished,
        action: 'map',
      },
    ];

    const completedSteps = gettingStartedSteps.filter(s => s.completed).length;

    // Build notifications
    const notifications = [];

    // Map unpublished changes notification
    if (mapHasDraftChanges) {
      notifications.push({
        id: 'map-draft',
        type: 'warning',
        title: 'Map has unpublished changes',
        message: 'Your changes are saved but not visible to customers yet.',
        action: 'map',
        timestamp: new Date().toISOString(),
      });
    }

    // Low stock notification
    if (lowStockCount > 0) {
      notifications.push({
        id: 'low-stock',
        type: 'warning',
        title: `${lowStockCount} product${lowStockCount > 1 ? 's' : ''} low on stock`,
        message: 'Consider restocking these items soon.',
        action: 'products',
        timestamp: new Date().toISOString(),
      });
    }

    // Out of stock notification
    if (outOfStockCount > 0) {
      notifications.push({
        id: 'out-of-stock',
        type: 'error',
        title: `${outOfStockCount} product${outOfStockCount > 1 ? 's' : ''} out of stock`,
        message: 'These items are unavailable to customers.',
        action: 'products',
        timestamp: new Date().toISOString(),
      });
    }

    // Missing images notification
    if (missingImagesCount > 0) {
      notifications.push({
        id: 'missing-images',
        type: 'info',
        title: `${missingImagesCount} product${missingImagesCount > 1 ? 's' : ''} missing images`,
        message: 'Add images to improve the shopping experience.',
        action: 'products',
        timestamp: new Date().toISOString(),
      });
    }

    // Missing location notification
    if (missingLocationCount > 0 && totalProducts > 0) {
      notifications.push({
        id: 'missing-location',
        type: 'info',
        title: `${missingLocationCount} product${missingLocationCount > 1 ? 's' : ''} missing aisle location`,
        message: 'Add location data to help customers find products.',
        action: 'products',
        timestamp: new Date().toISOString(),
      });
    }

    // Unlinked products notification (if there are products but few linked)
    const unlinkedProducts = totalProducts - linkedProducts;
    if (totalProducts > 0 && unlinkedProducts > 0 && linkedProducts < totalProducts * 0.5) {
      notifications.push({
        id: 'unlinked-products',
        type: 'info',
        title: `${unlinkedProducts} product${unlinkedProducts > 1 ? 's' : ''} not linked to map`,
        message: 'Link products to pins so customers can find them.',
        action: 'map',
        timestamp: new Date().toISOString(),
      });
    }

    // Success notification if map is published and no issues
    if (mapIsPublished && notifications.length === 0) {
      notifications.push({
        id: 'map-published',
        type: 'success',
        title: 'Store map is live',
        message: `Published ${lastPublishedAt ? new Date(lastPublishedAt).toLocaleDateString() : 'recently'}`,
        timestamp: lastPublishedAt || new Date().toISOString(),
      });
    }

    res.json({
      totalProducts,
      linkedProducts,
      unlinkedProducts,
      lowStockCount,
      outOfStockCount,
      missingImagesCount,
      missingLocationCount,
      mapHasDraftChanges,
      mapIsPublished,
      lastPublishedAt,
      gettingStarted: {
        steps: gettingStartedSteps,
        completedSteps,
        totalSteps: gettingStartedSteps.length,
      },
      notifications,
      analytics: {
        totalSearches: 0,
        searchesToday: 0,
        topCategories: [],
      },
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats', details: error.message });
  }
});

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `products-${Date.now()}.csv`);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  }
});

// Configure multer for image uploads (map images)
const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/maps');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `map-${Date.now()}-${file.originalname}`);
  }
});

const imageUpload = multer({
  storage: imageStorage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Get all products (admin view)
router.get('/products', async (req, res) => {
  try {
    const { page = 1, limit = 50, storeId = 1 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const storeIdParam = parseInt(storeId);

    // JOIN with store_inventory to get aisle and shelf data
    const result = await query(
      `SELECT 
        p.product_id,
        p.sku,
        p.product_name,
        p.category,
        p.base_price,
        p.image_url,
        p.description,
        p.created_at,
        si.aisle,
        si.shelf_position as shelf,
        si.stock_quantity,
        si.is_available
       FROM products p
       LEFT JOIN store_inventory si ON p.product_id = si.product_id AND si.store_id = $1
       ORDER BY p.product_id
       LIMIT $2 OFFSET $3`,
      [storeIdParam, parseInt(limit), offset]
    );

    const countResult = await query('SELECT COUNT(*) FROM products');
    const total = parseInt(countResult.rows[0].count);

    res.json({
      products: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// Create new product
router.post('/products', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const {
      sku,
      product_name,
      category,
      base_price,
      aisle,
      shelf,
      image_url,
      description,
      storeId = 1 // Default to store 1
    } = req.body;

    if (!sku || !product_name || !category || !base_price) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get chain_id from store
    const storeResult = await client.query('SELECT chain_id FROM stores WHERE store_id = $1', [storeId]);
    const chainId = storeResult.rows[0]?.chain_id;

    // Insert into products table
    const productResult = await client.query(
      `INSERT INTO products (sku, product_name, category, base_price, image_url, description, chain_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [sku, product_name, category, parseFloat(base_price), image_url, description, chainId]
    );

    const newProduct = productResult.rows[0];

    // Insert into store_inventory table
    // We need to handle aisle and shelf (shelf_position)
    if (aisle || shelf) {
      await client.query(
        `INSERT INTO store_inventory (store_id, product_id, aisle, shelf_position, stock_quantity, is_available)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (store_id, product_id) DO UPDATE SET
           aisle = EXCLUDED.aisle,
           shelf_position = EXCLUDED.shelf_position,
           last_updated = CURRENT_TIMESTAMP`,
        [storeId, newProduct.product_id, aisle || null, shelf || null, 0, true] // Default stock 0, available true
      );
    }

    await client.query('COMMIT');

    // Return product with inventory data
    const finalResult = {
      ...newProduct,
      aisle,
      shelf
    };

    res.status(201).json(finalResult);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating product:', error);
    if (error.code === '23505') {
      res.status(400).json({ error: 'Product with this SKU already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create product' });
    }
  } finally {
    client.release();
  }
});

// Update product
router.put('/products/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;
    const {
      sku,
      product_name,
      category,
      base_price,
      aisle,
      shelf,
      image_url,
      description,
      storeId = 1 // Default to store 1
    } = req.body;

    // Update products table
    const productResult = await client.query(
      `UPDATE products
       SET sku = $1, product_name = $2, category = $3, base_price = $4,
           image_url = $5, description = $6
       WHERE product_id = $7
       RETURNING *`,
      [sku, product_name, category, parseFloat(base_price), image_url, description, id]
    );

    if (productResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Product not found' });
    }

    const updatedProduct = productResult.rows[0];

    // Update or insert into store_inventory table
    if (aisle !== undefined || shelf !== undefined) {
      await client.query(
        `INSERT INTO store_inventory (store_id, product_id, aisle, shelf_position, stock_quantity, is_available)
         VALUES ($1, $2, $3, $4, 0, TRUE)
         ON CONFLICT (store_id, product_id) DO UPDATE SET
           aisle = COALESCE(EXCLUDED.aisle, store_inventory.aisle),
           shelf_position = COALESCE(EXCLUDED.shelf_position, store_inventory.shelf_position),
           last_updated = CURRENT_TIMESTAMP`,
        [storeId, id, aisle || null, shelf || null]
      );
    }

    await client.query('COMMIT');

    // Fetch updated inventory details to return a complete product object
    const inventoryResult = await client.query(
      `SELECT aisle, shelf_position FROM store_inventory WHERE store_id = $1 AND product_id = $2`,
      [storeId, id]
    );

    const inventoryData = inventoryResult.rows[0] || {};

    res.json({
      ...updatedProduct,
      aisle: inventoryData.aisle,
      shelf: inventoryData.shelf_position
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating product:', error);
    if (error.code === '23505') {
      res.status(400).json({ error: 'Product with this SKU already exists' });
    } else {
      res.status(500).json({ error: 'Failed to update product', details: error.message });
    }
  } finally {
    client.release();
  }
});

// Delete product
router.delete('/products/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // First delete from store_inventory (the correct table)
    await query('DELETE FROM store_inventory WHERE product_id = $1', [id]);

    const result = await query('DELETE FROM products WHERE product_id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({ message: 'Product deleted successfully', product: result.rows[0] });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

// CSV Import endpoint
router.post('/import-products', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filePath = req.file.path;
    const products = [];

    // Parse CSV file
    await new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
          // Normalize keys to lowercase to handle potential case issues
          const normalizedRow = {};
          Object.keys(row).forEach(key => {
            normalizedRow[key.trim().toLowerCase()] = row[key];
          });
          products.push(normalizedRow);
        })
        .on('end', resolve)
        .on('error', reject);
    });

    if (products.length === 0) {
      fs.unlinkSync(filePath);
      return res.status(400).json({ error: 'CSV file is empty' });
    }

    let imported = 0;
    let errors = [];
    const storeId = req.body.storeId || 1;

    // Insert products
    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        const {
          sku,
          product_name,
          category,
          base_price,
          aisle,
          shelf_position,
          shelf, // Handle both shelf and shelf_position
          image_url,
          description,
          stock_quantity,
          is_available
        } = product;

        // Validate required fields
        if (!sku || !product_name || !category || !base_price) {
          errors.push({ row: i + 2, error: 'Missing required fields (sku, product_name, category, base_price)', data: product });
          await client.query('ROLLBACK');
          continue;
        }

        // Get chain_id from store
        const storeResult = await client.query('SELECT chain_id FROM stores WHERE store_id = $1', [storeId]);
        const chainId = storeResult.rows[0]?.chain_id;

        // Insert or Update Product
        const productResult = await client.query(
          `INSERT INTO products (sku, product_name, category, base_price, image_url, description, chain_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (chain_id, sku) DO UPDATE SET
             product_name = EXCLUDED.product_name,
             category = EXCLUDED.category,
             base_price = EXCLUDED.base_price,
             image_url = EXCLUDED.image_url,
             description = EXCLUDED.description
           RETURNING product_id`,
          [
            sku,
            product_name,
            category,
            parseFloat(base_price) || 0,
            image_url || null,
            description || null,
            chainId
          ]
        );

        const productId = productResult.rows[0].product_id;

        // Insert or Update Inventory
        // Use shelf_position if available, otherwise shelf
        const finalShelf = shelf_position || shelf;
        const stock = parseInt(stock_quantity) || 0;
        // Handle is_available: 't', 'true', '1', etc.
        let available = true;
        if (is_available !== undefined && is_available !== null && is_available !== '') {
          const val = String(is_available).toLowerCase();
          available = (val === 't' || val === 'true' || val === '1' || val === 'yes');
        }

        await client.query(
          `INSERT INTO store_inventory (store_id, product_id, aisle, shelf_position, stock_quantity, is_available)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (store_id, product_id) DO UPDATE SET
             aisle = EXCLUDED.aisle,
             shelf_position = EXCLUDED.shelf_position,
             stock_quantity = EXCLUDED.stock_quantity,
             is_available = EXCLUDED.is_available,
             last_updated = CURRENT_TIMESTAMP`,
          [
            storeId,
            productId,
            aisle || null,
            finalShelf || null,
            stock,
            available
          ]
        );

        await client.query('COMMIT');
        imported++;
      } catch (error) {
        await client.query('ROLLBACK');
        errors.push({ row: i + 2, error: error.message, data: product });
      } finally {
        client.release();
      }
    }

    // Clean up uploaded file
    fs.unlinkSync(filePath);

    res.json({
      success: true,
      imported,
      total: products.length,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Error importing products:', error);
    if (req.file) {
      try { fs.unlinkSync(req.file.path); } catch (e) { }
    }
    res.status(500).json({ error: 'Failed to import products', details: error.message });
  }
});

// Get store map data
router.get('/stores/:id/map', async (req, res) => {
  try {
    const { id } = req.params;
    const { published } = req.query; // Query param to filter by published status

    const storeResult = await query('SELECT * FROM stores WHERE store_id = $1', [id]);

    if (storeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Store not found' });
    }

    // If published=true, only return published elements (for consumer view)
    // Otherwise return all elements (for editor view)
    let elementsQuery;
    if (published === 'true') {
      elementsQuery = await query(
        'SELECT * FROM store_map_elements WHERE store_id = $1 AND is_published = true ORDER BY z_index, id',
        [id]
      );
    } else {
      elementsQuery = await query(
        'SELECT * FROM store_map_elements WHERE store_id = $1 ORDER BY z_index, id',
        [id]
      );
    }

    res.json({
      store: storeResult.rows[0],
      elements: elementsQuery.rows.map(row => ({
        ...row,
        metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : (row.metadata || {})
      }))
    });
  } catch (error) {
    console.error('Error fetching map:', error);
    res.status(500).json({ error: 'Failed to fetch map', details: error.message });
  }
});

// Update store map image
router.post('/stores/:id/map/image', (req, res, next) => {
  imageUpload.single('image')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File size too large. Maximum size is 10MB.' });
      }
      return res.status(400).json({ error: err.message || 'File upload error' });
    }
    next();
  });
}, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided. Please select an image file.' });
    }

    // Validate file type
    if (!req.file.mimetype.startsWith('image/')) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Invalid file type. Please upload an image file (JPG, PNG, GIF, etc.)' });
    }

    // Save relative path for serving
    const imageUrl = `/uploads/maps/${req.file.filename}`;

    // Verify store exists
    const storeCheck = await query('SELECT store_id FROM stores WHERE store_id = $1', [id]);
    if (storeCheck.rows.length === 0) {
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: 'Store not found' });
    }

    // Update store with new map image URL
    await query(
      'UPDATE stores SET map_image_url = $1 WHERE store_id = $2',
      [imageUrl, id]
    );

    res.json({ success: true, imageUrl });
  } catch (error) {
    console.error('Error updating map image:', error);
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkError) {
        console.error('Error deleting uploaded file:', unlinkError);
      }
    }
    res.status(500).json({
      error: 'Failed to update map image',
      details: error.message || 'An unexpected error occurred'
    });
  }
});

// Save map elements
router.post('/stores/:id/map/elements', async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { elements } = req.body;

    if (!Array.isArray(elements)) {
      client.release();
      return res.status(400).json({ error: 'Elements must be an array' });
    }

    await client.query('BEGIN');

    // STEP 1: Get existing elements and build ID mappings
    const existingElements = await client.query(
      'SELECT id, metadata FROM store_map_elements WHERE store_id = $1',
      [id]
    );

    // Build map: frontendId -> old database ID (and also dbId -> dbId)
    const frontendIdToOldDbId = new Map();
    existingElements.rows.forEach(row => {
      const metadata = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : (row.metadata || {});
      const frontendId = metadata.frontendId || row.id.toString();
      frontendIdToOldDbId.set(frontendId, row.id);
      // Also map by database ID in case frontend uses that as element ID after reload
      frontendIdToOldDbId.set(row.id.toString(), row.id);
    });

    // STEP 2: BEFORE deleting elements, save all product links with their frontend ID mapping
    // This is crucial because DELETE CASCADE will remove all product_map_links
    const existingLinks = await client.query(
      `SELECT pml.product_id, pml.map_element_id, sme.metadata
       FROM product_map_links pml
       JOIN store_map_elements sme ON pml.map_element_id = sme.id
       WHERE pml.store_id = $1`,
      [id]
    );

    // Build a list of links with their frontend IDs for later restoration
    const savedLinks = existingLinks.rows.map(link => {
      const metadata = typeof link.metadata === 'string' ? JSON.parse(link.metadata) : (link.metadata || {});
      const frontendId = metadata.frontendId || link.map_element_id.toString();
      return {
        productId: link.product_id,
        frontendId: frontendId,
        oldDbId: link.map_element_id
      };
    });

    // STEP 3: Delete existing elements (CASCADE will delete product_map_links)
    await client.query('DELETE FROM store_map_elements WHERE store_id = $1', [id]);

    // STEP 4: Insert new elements and track the new database IDs
    const frontendIdToNewDbId = new Map();

    for (const element of elements) {
      const { type, name, x, y, width, height, color, zIndex, metadata, ...restProperties } = element;

      const fullMetadata = {
        ...(metadata || {}),
        ...restProperties,
        type: element.type, // Store type in metadata for frontend to use
        showNameOn: element.showNameOn,
        labelOffsetX: element.labelOffsetX,
        labelOffsetY: element.labelOffsetY,
        fillColor: element.fillColor,
        fillOpacity: element.fillOpacity,
        strokeColor: element.strokeColor,
        strokeWidth: element.strokeWidth,
        strokeOpacity: element.strokeOpacity,
        rotation: element.rotation,
        visible: element.visible,
        locked: element.locked,
        cornerRadius: element.cornerRadius,
        text: element.text,
        fontSize: element.fontSize,
        fontFamily: element.fontFamily,
        fontWeight: element.fontWeight,
        textAlign: element.textAlign,
        points: element.points,
        freehandPoints: element.freehandPoints,
        sides: element.sides,
        animationStyle: element.animationStyle,
        pinLabel: element.pinLabel,
        frontendId: element.id,
      };

      const insertResult = await client.query(
        `INSERT INTO store_map_elements
          (store_id, element_type, name, x, y, width, height, color, z_index, metadata)
         VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id`,
        [
          id,
          element.type,
          element.name || null,
          element.x,
          element.y,
          element.width,
          element.height,
          element.color || element.fillColor || '#3b82f6',
          element.zIndex || 0,
          JSON.stringify(fullMetadata)
        ]
      );

      const newDbId = insertResult.rows[0].id;
      frontendIdToNewDbId.set(element.id.toString(), newDbId);
      // Also map by the old database ID if this element had one
      const oldDbId = frontendIdToOldDbId.get(element.id.toString());
      if (oldDbId) {
        frontendIdToNewDbId.set(oldDbId.toString(), newDbId);
      }
    }

    // STEP 5: Restore product links using the new element IDs
    for (const link of savedLinks) {
      // Try to find the new database ID for this element
      // First try by frontendId, then by oldDbId
      let newDbId = frontendIdToNewDbId.get(link.frontendId);
      if (!newDbId) {
        newDbId = frontendIdToNewDbId.get(link.oldDbId.toString());
      }

      if (newDbId) {
        // Re-insert the product link with the new element ID
        await client.query(
          `INSERT INTO product_map_links (store_id, product_id, map_element_id)
           VALUES ($1, $2, $3)
           ON CONFLICT (store_id, product_id, map_element_id) DO NOTHING`,
          [id, link.productId, newDbId]
        );
      }
    }

    await client.query('COMMIT');

    res.json({ success: true, count: elements.length });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error saving map elements:', error);
    res.status(500).json({ error: 'Failed to save map elements', details: error.message });
  } finally {
    client.release();
  }
});

// ============================================
// INDIVIDUAL MAP ELEMENT OPERATIONS (Auto-save)
// ============================================

// Create a single map element
router.post('/stores/:id/map/element', async (req, res) => {
  try {
    const { id } = req.params;
    const { element } = req.body;

    if (!element) {
      return res.status(400).json({ error: 'Element is required' });
    }

    const { type, name, x, y, width, height, color, zIndex, metadata, ...restProperties } = element;

    const fullMetadata = {
      ...(metadata || {}),
      ...restProperties,
      type: element.type,
      showNameOn: element.showNameOn,
      labelOffsetX: element.labelOffsetX,
      labelOffsetY: element.labelOffsetY,
      fillColor: element.fillColor,
      fillOpacity: element.fillOpacity,
      strokeColor: element.strokeColor,
      strokeWidth: element.strokeWidth,
      strokeOpacity: element.strokeOpacity,
      rotation: element.rotation,
      visible: element.visible,
      locked: element.locked,
      cornerRadius: element.cornerRadius,
      text: element.text,
      fontSize: element.fontSize,
      fontFamily: element.fontFamily,
      fontWeight: element.fontWeight,
      textAlign: element.textAlign,
      points: element.points,
      freehandPoints: element.freehandPoints,
      sides: element.sides,
      animationStyle: element.animationStyle,
      pinLabel: element.pinLabel,
      pinLabelFontSize: element.pinLabelFontSize,
      pinLabelColor: element.pinLabelColor,
      pinLabelFontWeight: element.pinLabelFontWeight,
      frontendId: element.id,
    };

    const result = await query(
      `INSERT INTO store_map_elements
        (store_id, element_type, name, x, y, width, height, color, z_index, metadata, is_published)
       VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, false)
       RETURNING id`,
      [
        id,
        element.type,
        element.name || null,
        element.x,
        element.y,
        element.width,
        element.height,
        element.color || element.fillColor || '#3b82f6',
        element.zIndex || 0,
        JSON.stringify(fullMetadata)
      ]
    );

    // Mark store as having draft changes
    await query(
      'UPDATE stores SET map_has_draft_changes = true WHERE store_id = $1',
      [id]
    );

    const newDbId = result.rows[0].id;
    console.log(`[CREATE ELEMENT] Created element ${newDbId} for store ${id}`);

    res.json({
      success: true,
      elementId: newDbId,
      frontendId: element.id
    });
  } catch (error) {
    console.error('Error creating map element:', error);
    res.status(500).json({ error: 'Failed to create map element', details: error.message });
  }
});

// Update a single map element
router.put('/stores/:id/map/element/:elementId', async (req, res) => {
  try {
    const { id, elementId } = req.params;
    const { element } = req.body;

    if (!element) {
      return res.status(400).json({ error: 'Element is required' });
    }

    // Get existing element to preserve metadata we don't want to overwrite
    const existing = await query(
      'SELECT metadata FROM store_map_elements WHERE id = $1 AND store_id = $2',
      [elementId, id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Element not found' });
    }

    const existingMetadata = typeof existing.rows[0].metadata === 'string'
      ? JSON.parse(existing.rows[0].metadata)
      : (existing.rows[0].metadata || {});

    const { type, name, x, y, width, height, color, zIndex, metadata, ...restProperties } = element;

    const fullMetadata = {
      ...existingMetadata,
      ...(metadata || {}),
      ...restProperties,
      type: element.type,
      showNameOn: element.showNameOn,
      labelOffsetX: element.labelOffsetX,
      labelOffsetY: element.labelOffsetY,
      fillColor: element.fillColor,
      fillOpacity: element.fillOpacity,
      strokeColor: element.strokeColor,
      strokeWidth: element.strokeWidth,
      strokeOpacity: element.strokeOpacity,
      rotation: element.rotation,
      visible: element.visible,
      locked: element.locked,
      cornerRadius: element.cornerRadius,
      text: element.text,
      fontSize: element.fontSize,
      fontFamily: element.fontFamily,
      fontWeight: element.fontWeight,
      textAlign: element.textAlign,
      points: element.points,
      freehandPoints: element.freehandPoints,
      sides: element.sides,
      animationStyle: element.animationStyle,
      pinLabel: element.pinLabel,
      pinLabelFontSize: element.pinLabelFontSize,
      pinLabelColor: element.pinLabelColor,
      pinLabelFontWeight: element.pinLabelFontWeight,
      frontendId: existingMetadata.frontendId || element.id,
    };

    await query(
      `UPDATE store_map_elements
       SET element_type = $1, name = $2, x = $3, y = $4, width = $5, height = $6,
           color = $7, z_index = $8, metadata = $9, updated_at = CURRENT_TIMESTAMP,
           is_published = false
       WHERE id = $10 AND store_id = $11`,
      [
        element.type,
        element.name || null,
        element.x,
        element.y,
        element.width,
        element.height,
        element.color || element.fillColor || '#3b82f6',
        element.zIndex || 0,
        JSON.stringify(fullMetadata),
        elementId,
        id
      ]
    );

    // Mark store as having draft changes
    await query(
      'UPDATE stores SET map_has_draft_changes = true WHERE store_id = $1',
      [id]
    );

    console.log(`[UPDATE ELEMENT] Updated element ${elementId} for store ${id}`);

    res.json({ success: true, elementId: parseInt(elementId) });
  } catch (error) {
    console.error('Error updating map element:', error);
    res.status(500).json({ error: 'Failed to update map element', details: error.message });
  }
});

// Delete a single map element
router.delete('/stores/:id/map/element/:elementId', async (req, res) => {
  try {
    const { id, elementId } = req.params;

    // Check if element exists
    const existing = await query(
      'SELECT id FROM store_map_elements WHERE id = $1 AND store_id = $2',
      [elementId, id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Element not found' });
    }

    // Delete will cascade to product_map_links
    await query(
      'DELETE FROM store_map_elements WHERE id = $1 AND store_id = $2',
      [elementId, id]
    );

    console.log(`[DELETE ELEMENT] Deleted element ${elementId} for store ${id}`);

    res.json({ success: true, elementId: parseInt(elementId) });
  } catch (error) {
    console.error('Error deleting map element:', error);
    res.status(500).json({ error: 'Failed to delete map element', details: error.message });
  }
});

// Delete store map image
router.delete('/stores/:id/map/image', async (req, res) => {
  try {
    const { id } = req.params;

    // Verify store exists
    const storeCheck = await query('SELECT store_id FROM stores WHERE store_id = $1', [id]);
    if (storeCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Store not found' });
    }

    // Clear map image URL
    await query(
      'UPDATE stores SET map_image_url = NULL WHERE store_id = $1',
      [id]
    );

    // Also delete all elements
    await query('DELETE FROM store_map_elements WHERE store_id = $1', [id]);

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting map:', error);
    res.status(500).json({ error: 'Failed to delete map', details: error.message });
  }
});

// ============================================
// MAP PUBLISH ENDPOINTS
// ============================================

// Publish map - mark all current elements as published
router.post('/stores/:id/map/publish', async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;

    await client.query('BEGIN');

    // Mark all current elements for this store as published
    const result = await client.query(
      `UPDATE store_map_elements
       SET is_published = true,
           published_at = CURRENT_TIMESTAMP
       WHERE store_id = $1`,
      [id]
    );

    // Update store's map_published_at timestamp and clear draft flag
    await client.query(
      `UPDATE stores
       SET map_published_at = CURRENT_TIMESTAMP,
           map_has_draft_changes = false
       WHERE store_id = $1`,
      [id]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      publishedCount: result.rowCount,
      publishedAt: new Date().toISOString()
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error publishing map:', error);
    res.status(500).json({ error: 'Failed to publish map', details: error.message });
  } finally {
    client.release();
  }
});

// Get map publish status
router.get('/stores/:id/map/status', async (req, res) => {
  try {
    const { id } = req.params;

    const storeResult = await query(
      'SELECT map_published_at, map_has_draft_changes FROM stores WHERE store_id = $1',
      [id]
    );

    if (storeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Store not found' });
    }

    // Count unpublished elements
    const unpublishedCount = await query(
      'SELECT COUNT(*) FROM store_map_elements WHERE store_id = $1 AND is_published = false',
      [id]
    );

    // Count total elements
    const totalCount = await query(
      'SELECT COUNT(*) FROM store_map_elements WHERE store_id = $1',
      [id]
    );

    res.json({
      lastPublishedAt: storeResult.rows[0].map_published_at,
      hasDraftChanges: storeResult.rows[0].map_has_draft_changes || parseInt(unpublishedCount.rows[0].count) > 0,
      unpublishedElementCount: parseInt(unpublishedCount.rows[0].count),
      totalElementCount: parseInt(totalCount.rows[0].count)
    });
  } catch (error) {
    console.error('Error fetching map status:', error);
    res.status(500).json({ error: 'Failed to fetch map status', details: error.message });
  }
});

// ============================================
// UPLOADED IMAGES ENDPOINTS (for map editor)
// ============================================

// Get uploaded images for a store map
router.get('/stores/:id/map/uploaded-images', async (req, res) => {
  try {
    const { id } = req.params;
    const { published } = req.query;

    // Get from store_maps table
    const result = await query(
      'SELECT map_data FROM store_maps WHERE store_id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      // No map data yet, return empty array
      return res.json({ uploadedImages: [] });
    }

    const mapData = result.rows[0].map_data || {};

    // If published=true, return published images; otherwise return draft images
    const images = published === 'true'
      ? (mapData.publishedImages || mapData.uploadedImages || [])
      : (mapData.uploadedImages || []);

    res.json({ uploadedImages: images });
  } catch (error) {
    console.error('Error fetching uploaded images:', error);
    res.status(500).json({ error: 'Failed to fetch uploaded images', details: error.message });
  }
});

// Save uploaded images for a store map (draft)
router.post('/stores/:id/map/uploaded-images', async (req, res) => {
  try {
    const { id } = req.params;
    const { uploadedImages } = req.body;

    if (!Array.isArray(uploadedImages)) {
      return res.status(400).json({ error: 'uploadedImages must be an array' });
    }

    // Check if store_maps entry exists
    const existing = await query(
      'SELECT map_id, map_data FROM store_maps WHERE store_id = $1',
      [id]
    );

    if (existing.rows.length === 0) {
      // Create new entry
      await query(
        `INSERT INTO store_maps (store_id, map_data)
         VALUES ($1, $2)`,
        [id, JSON.stringify({ uploadedImages })]
      );
    } else {
      // Update existing entry, preserving other map_data fields
      const currentMapData = existing.rows[0].map_data || {};
      const newMapData = {
        ...currentMapData,
        uploadedImages
      };

      await query(
        `UPDATE store_maps SET map_data = $1, updated_at = CURRENT_TIMESTAMP WHERE store_id = $2`,
        [JSON.stringify(newMapData), id]
      );
    }

    // Mark store as having draft changes
    await query(
      'UPDATE stores SET map_has_draft_changes = true WHERE store_id = $1',
      [id]
    );

    console.log(`[SAVE IMAGES] Saved ${uploadedImages.length} images for store ${id}`);

    res.json({ success: true, count: uploadedImages.length });
  } catch (error) {
    console.error('Error saving uploaded images:', error);
    res.status(500).json({ error: 'Failed to save uploaded images', details: error.message });
  }
});

// Publish uploaded images (copy draft to published)
router.post('/stores/:id/map/uploaded-images/publish', async (req, res) => {
  try {
    const { id } = req.params;

    // Get current map data
    const result = await query(
      'SELECT map_data FROM store_maps WHERE store_id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.json({ success: true, count: 0 });
    }

    const mapData = result.rows[0].map_data || {};
    const draftImages = mapData.uploadedImages || [];

    // Copy draft images to published images
    const newMapData = {
      ...mapData,
      publishedImages: draftImages
    };

    await query(
      `UPDATE store_maps SET map_data = $1, updated_at = CURRENT_TIMESTAMP WHERE store_id = $2`,
      [JSON.stringify(newMapData), id]
    );

    console.log(`[PUBLISH IMAGES] Published ${draftImages.length} images for store ${id}`);

    res.json({ success: true, count: draftImages.length });
  } catch (error) {
    console.error('Error publishing uploaded images:', error);
    res.status(500).json({ error: 'Failed to publish uploaded images', details: error.message });
  }
});

// Get products for preview selector (only products with map links)
router.get('/stores/:storeId/products/preview', async (req, res) => {
  try {
    const { storeId } = req.params;
    const { search = '', limit = 100 } = req.query;

    let sql = `
      SELECT
        p.product_id,
        p.sku,
        p.product_name,
        p.category,
        p.image_url,
        si.aisle,
        si.shelf_position as shelf,
        pml.map_element_id
      FROM products p
      LEFT JOIN store_inventory si ON p.product_id = si.product_id AND si.store_id = $1
      LEFT JOIN product_map_links pml ON p.product_id = pml.product_id AND pml.store_id = $1
      WHERE pml.map_element_id IS NOT NULL
    `;

    const params = [storeId];

    if (search) {
      sql += ` AND (LOWER(p.product_name) LIKE $2 OR LOWER(p.sku) LIKE $2)`;
      params.push(`%${search.toLowerCase()}%`);
    }

    sql += ` ORDER BY p.product_name LIMIT $${params.length + 1}`;
    params.push(parseInt(limit));

    const result = await query(sql, params);

    res.json({
      products: result.rows.map(row => ({
        id: row.product_id,
        name: row.product_name,
        sku: row.sku,
        category: row.category,
        imageUrl: row.image_url,
        aisle: row.aisle,
        shelf: row.shelf,
        mapElementId: row.map_element_id
      }))
    });
  } catch (error) {
    console.error('Error fetching products for preview:', error);
    res.status(500).json({ error: 'Failed to fetch products', details: error.message });
  }
});

// ============================================
// SMART PIN PRODUCT LINKING ENDPOINTS
// ============================================

// Helper function to update smart pin metadata with linked product locations
const updatePinLocationMetadata = async (client, storeId, elementDbId) => {
  try {
    // Get all linked products' location info for this pin
    const locationResult = await client.query(
      `SELECT DISTINCT si.aisle, si.shelf_position as shelf
       FROM product_map_links pml
       JOIN store_inventory si ON pml.product_id = si.product_id AND si.store_id = pml.store_id
       WHERE pml.store_id = $1 AND pml.map_element_id = $2
       AND si.aisle IS NOT NULL
       ORDER BY si.aisle, si.shelf_position`,
      [storeId, elementDbId]
    );

    // Build location summary
    const locations = locationResult.rows;
    let locationSummary = null;
    
    if (locations.length > 0) {
      // Get unique aisles
      const aisles = [...new Set(locations.map(l => l.aisle).filter(Boolean))];
      // Get unique shelves
      const shelves = [...new Set(locations.map(l => l.shelf).filter(Boolean))];
      
      locationSummary = {
        aisles: aisles,
        shelves: shelves,
        primaryAisle: aisles[0] || null,
        primaryShelf: shelves[0] || null,
        locationCount: locations.length
      };
    }

    // Update the pin's metadata with location info
    await client.query(
      `UPDATE store_map_elements 
       SET metadata = jsonb_set(
         COALESCE(metadata, '{}'::jsonb),
         '{linkedLocations}',
         $1::jsonb
       ),
       updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [JSON.stringify(locationSummary), elementDbId]
    );

    return locationSummary;
  } catch (error) {
    console.error('Error updating pin location metadata:', error);
    // Don't throw - this is a non-critical update
    return null;
  }
};

// Helper function to resolve element database ID from frontend ID or database ID
// The frontend may send timestamp-based IDs that need to be looked up in the database
const resolveElementId = async (storeId, pinId) => {
  // First, try to parse as integer and check if it's a valid database ID
  const parsedId = parseInt(pinId);
  if (!isNaN(parsedId) && parsedId > 0 && parsedId <= 2147483647) {
    // Check if this ID exists in the database
    const checkResult = await query(
      'SELECT id FROM store_map_elements WHERE id = $1 AND store_id = $2',
      [parsedId, storeId]
    );
    if (checkResult.rows.length > 0) {
      return parsedId;
    }
  }
  
  // If not found as database ID, try to find by frontend ID stored in metadata
  // We stored frontend IDs in metadata.frontendId when saving
  const searchResult = await query(
    `SELECT id FROM store_map_elements 
     WHERE store_id = $1 
     AND metadata->>'frontendId' = $2`,
    [storeId, pinId.toString()]
  );
  
  if (searchResult.rows.length > 0) {
    return searchResult.rows[0].id;
  }
  
  // If still not found, return null (element might not be saved yet)
  return null;
};

// Get all products linked to a specific pin
router.get('/stores/:storeId/pins/:pinId/products', async (req, res) => {
  try {
    const { storeId, pinId } = req.params;

    // Resolve the database element ID from frontend ID or database ID
    const elementDbId = await resolveElementId(storeId, pinId);
    if (!elementDbId) {
      return res.status(404).json({ error: 'Pin not found. Please save your map first before linking products.' });
    }

    // Get linked products with product details
    const result = await query(
      `SELECT 
        p.product_id,
        p.sku,
        p.product_name,
        p.category,
        p.base_price,
        p.image_url,
        p.description,
        si.aisle,
        si.shelf_position as shelf,
        pml.link_id,
        pml.created_at as linked_at
       FROM product_map_links pml
       JOIN products p ON pml.product_id = p.product_id
       LEFT JOIN store_inventory si ON p.product_id = si.product_id AND si.store_id = $1
       WHERE pml.store_id = $1 AND pml.map_element_id = $2
       ORDER BY p.product_name`,
      [storeId, elementDbId]
    );

    res.json({
      pinId: parseInt(pinId),
      storeId: parseInt(storeId),
      linkedProducts: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching linked products:', error);
    res.status(500).json({ error: 'Failed to fetch linked products', details: error.message });
  }
});

// Link products to a pin (bulk operation)
router.post('/stores/:storeId/pins/:pinId/link', async (req, res) => {
  const client = await pool.connect();
  try {
    const { storeId, pinId } = req.params;
    const { productIds } = req.body;

    if (!Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ error: 'productIds must be a non-empty array' });
    }

    await client.query('BEGIN');

    // Resolve the database element ID from frontend ID or database ID
    const elementDbId = await resolveElementId(storeId, pinId);
    if (!elementDbId) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json({ error: 'Pin not found. Please save your map first before linking products.' });
    }

    // Verify pin exists
    const pinCheck = await client.query(
      'SELECT id FROM store_map_elements WHERE id = $1 AND store_id = $2',
      [elementDbId, storeId]
    );
    if (pinCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json({ error: 'Pin not found' });
    }

    let linked = 0;
    let errors = [];

    for (const productId of productIds) {
      try {
        await client.query(
          `INSERT INTO product_map_links (store_id, product_id, map_element_id)
           VALUES ($1, $2, $3)
           ON CONFLICT (store_id, product_id, map_element_id) DO NOTHING`,
          [storeId, productId, elementDbId]
        );
        linked++;
      } catch (err) {
        errors.push({ productId, error: err.message });
      }
    }

    // Update the smart pin's metadata with location info from linked products
    const locationSummary = await updatePinLocationMetadata(client, storeId, elementDbId);

    await client.query('COMMIT');

    res.json({
      success: true,
      linked,
      total: productIds.length,
      locationSummary,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error linking products:', error);
    res.status(500).json({ error: 'Failed to link products', details: error.message });
  } finally {
    client.release();
  }
});

// Unlink products from a pin (bulk operation)
router.delete('/stores/:storeId/pins/:pinId/unlink', async (req, res) => {
  try {
    const { storeId, pinId } = req.params;
    const { productIds } = req.body;

    if (!Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ error: 'productIds must be a non-empty array' });
    }

    // Resolve the database element ID from frontend ID or database ID
    const elementDbId = await resolveElementId(storeId, pinId);
    if (!elementDbId) {
      return res.status(404).json({ error: 'Pin not found. Please save your map first before unlinking products.' });
    }

    // Delete the links
    const result = await query(
      `DELETE FROM product_map_links 
       WHERE store_id = $1 AND map_element_id = $2 AND product_id = ANY($3)
       RETURNING link_id`,
      [storeId, elementDbId, productIds]
    );

    // Update the smart pin's metadata with remaining location info
    // Use a simple client wrapper for the helper
    const clientWrapper = { query: (sql, params) => query(sql, params) };
    const locationSummary = await updatePinLocationMetadata(clientWrapper, storeId, elementDbId);

    res.json({
      success: true,
      unlinked: result.rows.length,
      total: productIds.length,
      locationSummary
    });
  } catch (error) {
    console.error('Error unlinking products:', error);
    res.status(500).json({ error: 'Failed to unlink products', details: error.message });
  }
});

// Get all products with their link status for a specific pin
router.get('/stores/:storeId/pins/:pinId/products/all', async (req, res) => {
  try {
    const { storeId, pinId } = req.params;
    const { search = '', page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Resolve the database element ID from frontend ID or database ID
    const elementDbId = await resolveElementId(storeId, pinId);
    if (!elementDbId) {
      return res.status(404).json({ error: 'Pin not found. Please save your map first before linking products.' });
    }

    // Get all products with link status
    let sql = `
      SELECT 
        p.product_id,
        p.sku,
        p.product_name,
        p.category,
        p.base_price,
        p.image_url,
        si.aisle,
        si.shelf_position as shelf,
        CASE WHEN pml.link_id IS NOT NULL THEN true ELSE false END as is_linked,
        pml.link_id
       FROM products p
       LEFT JOIN store_inventory si ON p.product_id = si.product_id AND si.store_id = $1
       LEFT JOIN product_map_links pml ON p.product_id = pml.product_id AND pml.store_id = $1 AND pml.map_element_id = $2
    `;
    
    const params = [storeId, elementDbId];
    
    if (search) {
      sql += ` WHERE (LOWER(p.product_name) LIKE $3 OR LOWER(p.sku) LIKE $3 OR LOWER(p.category) LIKE $3)`;
      params.push(`%${search.toLowerCase()}%`);
    }
    
    sql += ` ORDER BY p.product_name LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), offset);

    const result = await query(sql, params);

    // Get total count
    let countSql = 'SELECT COUNT(*) FROM products p';
    const countParams = [];
    if (search) {
      countSql += ` WHERE (LOWER(p.product_name) LIKE $1 OR LOWER(p.sku) LIKE $1 OR LOWER(p.category) LIKE $1)`;
      countParams.push(`%${search.toLowerCase()}%`);
    }
    const countResult = await query(countSql, countParams);
    const total = parseInt(countResult.rows[0].count);

    res.json({
      products: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching products with link status:', error);
    res.status(500).json({ error: 'Failed to fetch products', details: error.message });
  }
});

// Sync product links for a pin (replace all links)
router.put('/stores/:storeId/pins/:pinId/link', async (req, res) => {
  const client = await pool.connect();
  try {
    const { storeId, pinId } = req.params;
    const { productIds } = req.body;

    if (!Array.isArray(productIds)) {
      return res.status(400).json({ error: 'productIds must be an array' });
    }

    await client.query('BEGIN');

    // Resolve the database element ID from frontend ID or database ID
    const elementDbId = await resolveElementId(storeId, pinId);
    if (!elementDbId) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json({ error: 'Pin not found. Please save your map first before linking products.' });
    }

    // Verify pin exists
    const pinCheck = await client.query(
      'SELECT id FROM store_map_elements WHERE id = $1 AND store_id = $2',
      [elementDbId, storeId]
    );
    if (pinCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json({ error: 'Pin not found' });
    }

    // Delete all existing links for this pin
    await client.query(
      'DELETE FROM product_map_links WHERE store_id = $1 AND map_element_id = $2',
      [storeId, elementDbId]
    );

    // Insert new links
    let linked = 0;
    for (const productId of productIds) {
      try {
        await client.query(
          `INSERT INTO product_map_links (store_id, product_id, map_element_id)
           VALUES ($1, $2, $3)`,
          [storeId, productId, elementDbId]
        );
        linked++;
      } catch (err) {
        // Skip duplicates or invalid product IDs
        console.error('Error linking product:', productId, err.message);
      }
    }

    // Update the smart pin's metadata with location info from linked products
    const locationSummary = await updatePinLocationMetadata(client, storeId, elementDbId);

    await client.query('COMMIT');

    res.json({
      success: true,
      linked,
      locationSummary,
      total: productIds.length
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error syncing product links:', error);
    res.status(500).json({ error: 'Failed to sync product links', details: error.message });
  } finally {
    client.release();
  }
});

export default router;

