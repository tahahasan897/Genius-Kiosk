# Kiosk Backend API

Backend API server for the Aisle Genius Kiosk application. Built with Express.js and PostgreSQL.

## Features

- Product search and retrieval
- Store information management
- Admin endpoints for product management
- CSV import functionality
- PostgreSQL database integration

## Prerequisites

- Node.js (v16 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn

## Setup Instructions

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Database Setup

First, make sure PostgreSQL is running on your system.

```bash
# Create the database
psql -U postgres
CREATE DATABASE kiosk_db;
\q
```

### 3. Configure Environment Variables

Create a `.env` file in the backend directory:

```bash
cp .env.example .env
```

Edit `.env` and update the `DATABASE_URL` with your PostgreSQL credentials:

```env
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/kiosk_db
PORT=3000
NODE_ENV=development
```

### 4. Initialize Database Schema

Run the setup script to create tables and insert sample data:

```bash
psql -U postgres -d kiosk_db -f setup.sql
```

This will:
- Create all necessary tables (stores, products, product_stores)
- Insert a default store
- Insert 8 sample products

### 5. Start the Server

For development (with auto-reload):

```bash
npm run dev
```

For production:

```bash
npm start
```

You should see:
```
🚀 Server running on port 3000
✅ Database connected successfully
```

## API Endpoints

### Products

- `GET /api/products/search?q={query}&storeId={id}` - Search products
- `GET /api/products/:id?storeId={id}` - Get product by ID
- `GET /api/products?page={page}&limit={limit}&category={cat}&storeId={id}` - List all products

### Stores

- `GET /api/stores` - Get all stores
- `GET /api/stores/:id` - Get store by ID

### Admin

- `GET /api/admin/products?page={page}&limit={limit}` - List all products (admin view)
- `POST /api/admin/products` - Create new product
- `PUT /api/admin/products/:id` - Update product
- `DELETE /api/admin/products/:id` - Delete product
- `POST /api/admin/import-products` - Import products from CSV file

### Health Check

- `GET /health` - Server health check

## CSV Import Format

When importing products via CSV, use the following columns:

- `sku` (required) - Product SKU
- `product_name` (required) - Product name
- `category` (required) - Product category
- `base_price` (required) - Base price
- `aisle` (optional) - Aisle number
- `shelf` (optional) - Shelf number
- `image_url` (optional) - Product image URL
- `description` (optional) - Product description

Example CSV:
```csv
sku,product_name,category,base_price,aisle,shelf,image_url,description
MILK002,2% Milk - 1 Gallon,Dairy,4.79,A1,Shelf 2,https://example.com/milk.jpg,Fresh 2% milk
```

## Project Structure

```
backend/
├── package.json          # Dependencies and scripts
├── server.js             # Main Express server
├── db.js                 # Database connection
├── setup.sql             # Database schema and sample data
├── .env.example          # Environment variables template
├── README.md             # This file
└── routes/
    ├── products.js       # Product API routes
    ├── stores.js         # Store API routes
    └── admin.js          # Admin API routes
```

## Development

The server uses `nodemon` for development, which automatically restarts the server when files change.

## Troubleshooting

### Database Connection Issues

- Verify PostgreSQL is running: `pg_isready`
- Check your `.env` file has the correct `DATABASE_URL`
- Ensure the database `kiosk_db` exists

### Port Already in Use

If port 3000 is already in use, change the `PORT` in your `.env` file.

### CSV Import Errors

- Ensure CSV file has proper headers
- Check that required fields (sku, product_name, category, base_price) are present
- Verify file is actually a CSV file

## License

ISC

