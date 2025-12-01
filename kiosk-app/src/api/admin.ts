import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface AdminProduct {
    product_id: number;
    sku: string;
    product_name: string;
    category: string;
    base_price: number;
    aisle: string;
    shelf: string;
    image_url: string;
    description: string;
    created_at: string;
    updated_at: string;
}

export interface ProductsResponse {
    products: AdminProduct[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
    };
}

export const getAdminProducts = async (page = 1, limit = 50): Promise<ProductsResponse> => {
    const response = await axios.get(`${API_URL}/api/admin/products`, {
        params: { page, limit }
    });
    return response.data;
};

export const createProduct = async (product: Partial<AdminProduct>): Promise<AdminProduct> => {
    const response = await axios.post(`${API_URL}/api/admin/products`, product);
    return response.data;
};

export const updateProduct = async (id: number, product: Partial<AdminProduct>): Promise<AdminProduct> => {
    const response = await axios.put(`${API_URL}/api/admin/products/${id}`, product);
    return response.data;
};

export const deleteProduct = async (id: number): Promise<void> => {
    await axios.delete(`${API_URL}/api/admin/products/${id}`);
};

export const importProducts = async (file: File, storeId: string = '1'): Promise<{
    success: boolean;
    imported: number;
    total: number;
    errors?: Array<{ row: number; error: string; data: any }>;
}> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('storeId', storeId);

    const response = await axios.post(`${API_URL}/api/admin/import-products`, formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });
    return response.data;
};