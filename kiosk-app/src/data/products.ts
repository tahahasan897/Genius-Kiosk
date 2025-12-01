export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  aisle: number;
  shelf: string;
  stockLevel: number;
  stockStatus: 'in-stock' | 'low-stock' | 'out-of-stock';
  image: string;
  description: string;
  mapX: number; // X coordinate on store map (percentage)
  mapY: number; // Y coordinate on store map (percentage)
}

export const products: Product[] = [
  {
    id: '1',
    name: 'Whole Milk - 1 Gallon',
    category: 'Dairy',
    price: 4.99,
    aisle: 3,
    shelf: 'B',
    stockLevel: 24,
    stockStatus: 'in-stock',
    image: '/placeholder.svg',
    description: 'Fresh whole milk, vitamin D fortified',
    mapX: 30,
    mapY: 40,
  },
  {
    id: '2',
    name: 'Whole Wheat Bread',
    category: 'Bakery',
    price: 3.49,
    aisle: 7,
    shelf: 'A',
    stockLevel: 8,
    stockStatus: 'low-stock',
    image: '/placeholder.svg',
    description: '100% whole wheat, fresh baked daily',
    mapX: 70,
    mapY: 30,
  },
  {
    id: '3',
    name: 'AA Batteries (8-Pack)',
    category: 'Electronics',
    price: 12.99,
    aisle: 12,
    shelf: 'C',
    stockLevel: 0,
    stockStatus: 'out-of-stock',
    image: '/placeholder.svg',
    description: 'Long-lasting alkaline batteries',
    mapX: 85,
    mapY: 70,
  },
  {
    id: '4',
    name: 'Moisturizing Shampoo',
    category: 'Personal Care',
    price: 8.99,
    aisle: 9,
    shelf: 'D',
    stockLevel: 15,
    stockStatus: 'in-stock',
    image: '/placeholder.svg',
    description: 'Hydrating shampoo for all hair types, 16 oz',
    mapX: 50,
    mapY: 60,
  },
  {
    id: '5',
    name: 'Honey Nut Cereal',
    category: 'Breakfast',
    price: 5.49,
    aisle: 5,
    shelf: 'A',
    stockLevel: 32,
    stockStatus: 'in-stock',
    image: '/placeholder.svg',
    description: 'Crunchy oat cereal with real honey, family size',
    mapX: 40,
    mapY: 25,
  },
  {
    id: '6',
    name: 'Organic Bananas',
    category: 'Produce',
    price: 2.99,
    aisle: 1,
    shelf: 'Display',
    stockLevel: 6,
    stockStatus: 'low-stock',
    image: '/placeholder.svg',
    description: 'Fresh organic bananas, per pound',
    mapX: 15,
    mapY: 20,
  },
  {
    id: '7',
    name: 'Ground Coffee - Medium Roast',
    category: 'Beverages',
    price: 9.99,
    aisle: 6,
    shelf: 'B',
    stockLevel: 18,
    stockStatus: 'in-stock',
    image: '/placeholder.svg',
    description: '100% Arabica beans, 12 oz bag',
    mapX: 55,
    mapY: 35,
  },
  {
    id: '8',
    name: 'Dish Soap - Lemon Scent',
    category: 'Cleaning',
    price: 4.49,
    aisle: 10,
    shelf: 'C',
    stockLevel: 3,
    stockStatus: 'low-stock',
    image: '/placeholder.svg',
    description: 'Ultra-concentrated dish detergent, 24 oz',
    mapX: 65,
    mapY: 55,
  },
];

export const searchProducts = (query: string): Product[] => {
  if (!query.trim()) return [];
  
  const lowerQuery = query.toLowerCase();
  return products.filter(
    (product) =>
      product.name.toLowerCase().includes(lowerQuery) ||
      product.category.toLowerCase().includes(lowerQuery) ||
      product.description.toLowerCase().includes(lowerQuery)
  );
};
