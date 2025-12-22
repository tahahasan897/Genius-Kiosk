import axios from 'axios';
import { Product } from '@/data/products';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const searchProducts = async (query: string, storeId: string): Promise<Product[]> => {
    if (!query.trim()) return [];
    const response = await axios.get(`${API_URL}/api/products/search`, {
        params: { q: query, storeId }
    });
    return response.data;
};

export const getProduct = async (id: string, storeId: string): Promise<Product> => {
    const response = await axios.get(`${API_URL}/api/products/${id}`, {
        params: { storeId }
    });
    return response.data;
};