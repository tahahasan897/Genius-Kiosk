import axios from 'axios';
import { auth } from '@/lib/firebase';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Helper to get auth headers
const getAuthHeaders = () => {
  const user = auth?.currentUser;
  if (!user) {
    return {};
  }
  return {
    'x-firebase-uid': user.uid,
    'x-firebase-email': user.email || '',
  };
};

// Dashboard Types
export interface GettingStartedStep {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  action?: string; // Tab to navigate to
}

export interface Notification {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message?: string;
  action?: string; // Tab to navigate to
  timestamp?: string;
}

export interface AnalyticsSummary {
  topSearchedProduct?: {
    name: string;
    searchCount: number;
  };
  totalSearches: number;
  searchesToday: number;
  topCategories?: Array<{
    name: string;
    count: number;
  }>;
}

export interface DashboardStats {
  totalProducts: number;
  linkedProducts: number;
  unlinkedProducts: number;
  lowStockCount: number;
  outOfStockCount: number;
  missingImagesCount: number;
  missingLocationCount: number;
  mapHasDraftChanges: boolean;
  mapIsPublished: boolean;
  lastPublishedAt?: string;
  gettingStarted: {
    steps: GettingStartedStep[];
    completedSteps: number;
    totalSteps: number;
  };
  notifications: Notification[];
  analytics?: AnalyticsSummary;
}

export interface AdminProduct {
    product_id: number;
    sku: string;
    product_name: string;
    category: string;
    base_price: number;
    aisle: string;
    shelf: string;
    stock_quantity: number;
    is_available: boolean;
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

export const getAdminProducts = async (page = 1, limit = 50, storeId = 1): Promise<ProductsResponse> => {
    const headers = getAuthHeaders();
    const response = await axios.get(`${API_URL}/api/admin/products`, {
        headers,
        params: { page, limit, storeId }
    });
    return response.data;
};

export const createProduct = async (product: Partial<AdminProduct> & { storeId?: number }): Promise<AdminProduct> => {
    const headers = getAuthHeaders();
    const response = await axios.post(`${API_URL}/api/admin/products`, product, { headers });
    return response.data;
};

export const updateProduct = async (id: number, product: Partial<AdminProduct> & { storeId?: number }): Promise<AdminProduct> => {
    const headers = getAuthHeaders();
    const response = await axios.put(`${API_URL}/api/admin/products/${id}`, product, { headers });
    return response.data;
};

export const deleteProduct = async (id: number): Promise<void> => {
    const headers = getAuthHeaders();
    await axios.delete(`${API_URL}/api/admin/products/${id}`, { headers });
};

export const importProducts = async (file: File, storeId: string = '1'): Promise<{
    success: boolean;
    imported: number;
    total: number;
    errors?: Array<{ row: number; error: string; data: any }>;
}> => {
    const headers = getAuthHeaders();
    const formData = new FormData();
    formData.append('file', file);
    formData.append('storeId', storeId);

    const response = await axios.post(`${API_URL}/api/admin/import-products`, formData, {
        headers: {
            ...headers,
            'Content-Type': 'multipart/form-data',
        },
    });
    return response.data;
};

// Dashboard
export const getDashboardStats = async (storeId: number = 1): Promise<DashboardStats> => {
    const headers = getAuthHeaders();
    const response = await axios.get(`${API_URL}/api/admin/dashboard`, {
        headers,
        params: { storeId }
    });
    return response.data;
};

// ============================================
// NOTIFICATION HISTORY
// ============================================

export interface NotificationHistoryItem {
    id: number;
    notification_id: string;
    type: 'info' | 'warning' | 'error' | 'success';
    title: string;
    message?: string;
    action?: string;
    is_resolved: boolean;
    resolved_at?: string;
    created_at: string;
}

export interface NotificationHistoryResponse {
    notifications: NotificationHistoryItem[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
    };
}

// Get notification history with pagination
export const getNotificationHistory = async (
    chainId: number,
    page: number = 1,
    limit: number = 10
): Promise<NotificationHistoryResponse> => {
    const headers = getAuthHeaders();
    const response = await axios.get(`${API_URL}/api/admin/notifications`, {
        headers,
        params: { chainId, page, limit }
    });
    return response.data;
};

// Log notifications to history
export const logNotifications = async (
    chainId: number,
    notifications: Notification[]
): Promise<void> => {
    const headers = getAuthHeaders();
    await axios.post(`${API_URL}/api/admin/notifications`, {
        chainId,
        notifications
    }, { headers });
};

// Mark notification as resolved
export const resolveNotification = async (notificationId: number): Promise<NotificationHistoryItem> => {
    const headers = getAuthHeaders();
    const response = await axios.patch(`${API_URL}/api/admin/notifications/${notificationId}/resolve`, {}, { headers });
    return response.data;
};

// Auto-resolve notifications that are no longer applicable
export const autoResolveNotifications = async (
    chainId: number,
    activeNotificationIds: string[]
): Promise<void> => {
    const headers = getAuthHeaders();
    await axios.post(`${API_URL}/api/admin/notifications/auto-resolve`, {
        chainId,
        activeNotificationIds
    }, { headers });
};