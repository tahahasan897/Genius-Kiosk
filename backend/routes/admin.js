import express from 'express';
import multer from 'multer';
import csv from 'csv-parser';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query } from '../db.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
    const { page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const result = await query(
      `SELECT * FROM products ORDER BY product_id LIMIT $1 OFFSET $2`,
      [parseInt(limit), offset]
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
  try {
    const {
      sku,
      product_name,
      category,
      base_price,
      aisle,
      shelf,
      image_url,
      description
    } = req.body;

    if (!sku || !product_name || !category || !base_price) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await query(
      `INSERT INTO products (sku, product_name, category, base_price, aisle, shelf, image_url, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [sku, product_name, category, parseFloat(base_price), aisle, shelf, image_url, description]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating product:', error);
    if (error.code === '23505') {
      res.status(400).json({ error: 'Product with this SKU already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create product' });
    }
  }
});

// Update product
router.put('/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      sku,
      product_name,
      category,
      base_price,
      aisle,
      shelf,
      image_url,
      description
    } = req.body;

    const result = await query(
      `UPDATE products 
       SET sku = $1, product_name = $2, category = $3, base_price = $4, 
           aisle = $5, shelf = $6, image_url = $7, description = $8,
           updated_at = CURRENT_TIMESTAMP
       WHERE product_id = $9
       RETURNING *`,
      [sku, product_name, category, parseFloat(base_price), aisle, shelf, image_url, description, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// Delete product
router.delete('/products/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // First delete from product_stores
    await query('DELETE FROM product_stores WHERE product_id = $1', [id]);

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
          products.push(row);
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

    // Insert products
    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      try {
        const {
          sku,
          product_name,
          category,
          base_price,
          aisle,
          shelf,
          image_url,
          description
        } = product;

        if (!sku || !product_name || !category || !base_price) {
          errors.push({ row: i + 2, error: 'Missing required fields', data: product });
          continue;
        }

        // Try to insert or update
        await query(
          `INSERT INTO products (sku, product_name, category, base_price, aisle, shelf, image_url, description)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (sku) DO UPDATE SET
             product_name = EXCLUDED.product_name,
             category = EXCLUDED.category,
             base_price = EXCLUDED.base_price,
             aisle = EXCLUDED.aisle,
             shelf = EXCLUDED.shelf,
             image_url = EXCLUDED.image_url,
             description = EXCLUDED.description,
             updated_at = CURRENT_TIMESTAMP`,
          [
            sku,
            product_name,
            category,
            parseFloat(base_price) || 0,
            aisle || null,
            shelf || null,
            image_url || null,
            description || null
          ]
        );

        imported++;
      } catch (error) {
        errors.push({ row: i + 2, error: error.message, data: product });
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
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: 'Failed to import products', details: error.message });
  }
});

// Get store map data
router.get('/stores/:id/map', async (req, res) => {
  try {
    const { id } = req.params;
    const storeResult = await query('SELECT * FROM stores WHERE store_id = $1', [id]);
    
    if (storeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Store not found' });
    }
    
    const elementsResult = await query(
      'SELECT * FROM store_map_elements WHERE store_id = $1 ORDER BY z_index, id',
      [id]
    );
    
    res.json({
      store: storeResult.rows[0],
      elements: elementsResult.rows.map(row => ({
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
  try {
    const { id } = req.params;
    const { elements } = req.body;
    
    if (!Array.isArray(elements)) {
      return res.status(400).json({ error: 'Elements must be an array' });
    }
    
    // Delete existing elements
    await query('DELETE FROM store_map_elements WHERE store_id = $1', [id]);
    
    // Insert new elements
    for (const element of elements) {
      // Extract metadata: save all properties except those that have dedicated columns
      const { type, name, x, y, width, height, color, zIndex, metadata, ...restProperties } = element;
      
      // Merge rest properties with existing metadata to preserve everything
      const fullMetadata = {
        ...(metadata || {}),
        ...restProperties,
        // Explicitly include important properties that might be missing
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
      };
      
      await query(
        `INSERT INTO store_map_elements 
         (store_id, element_type, name, x, y, width, height, color, z_index, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
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
    }
    
    res.json({ success: true, count: elements.length });
  } catch (error) {
    console.error('Error saving map elements:', error);
    res.status(500).json({ error: 'Failed to save map elements', details: error.message });
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

export default router;

