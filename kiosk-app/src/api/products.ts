import axios from 'axios';
import { Product } from '@/data/products';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const STORE_ID = import.meta.env.VITE_STORE_ID || '1';

export const searchProducts = async (query: string): Promise<Product[]> => {
    if (!query.trim()) return [];
    const response = await axios.get(`${API_URL}/api/products/search`, {
        params: { q: query, storeId: STORE_ID }
    });
    return response.data;
};

export const getProduct = async (id: string): Promise<Product> => {
    const response = await axios.get(`${API_URL}/api/products/${id}`, {
        params: { storeId: STORE_ID }
    });
    return response.data;
};