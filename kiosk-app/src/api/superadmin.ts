import axios from 'axios';
import { auth } from '@/lib/firebase';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Helper to get auth headers
const getAuthHeaders = async () => {
  const user = auth?.currentUser;
  if (!user) {
    throw new Error('Not authenticated');
  }
  return {
    'x-firebase-uid': user.uid,
    'x-firebase-email': user.email || '',
  };
};

// Types
export interface AdminUser {
  user_id: number;
  firebase_uid: string;
  email: string;
  display_name: string | null;
  is_super_admin: boolean;
  chain_id: number | null;
  chain_name?: string | null;
  created_at: string;
  last_login: string | null;
}

export interface AdminRoleResponse {
  isAdmin: boolean;
  isSuperAdmin: boolean;
  userId?: number;
  email?: string;
  displayName?: string | null;
  chainId?: number | null;
}

export interface Chain {
  chain_id: number;
  chain_name: string;
  is_active: boolean;
  created_at: string;
  store_count?: number;
  product_count?: number;
}

export interface Store {
  store_id: number;
  chain_id: number;
  chain_name?: string;
  store_name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  map_published_at: string | null;
  map_elements_count?: number;
  products_count?: number;
}

export interface DashboardStats {
  stats: {
    totalChains: number;
    totalStores: number;
    totalProducts: number;
    totalAdmins: number;
  };
  recentChains: Array<{
    chain_id: number;
    chain_name: string;
    created_at: string;
  }>;
  recentStores: Array<{
    store_id: number;
    store_name: string;
    created_at: string;
    chain_name: string;
  }>;
  topChains: Array<{
    chain_id: number;
    chain_name: string;
    store_count: number;
  }>;
}

export interface PaginatedResponse<T> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  [key: string]: T[] | PaginatedResponse<T>['pagination'];
}

// ============================================
// ADMIN ROLE CHECK
// ============================================

export const checkAdminRole = async (): Promise<AdminRoleResponse> => {
  const headers = await getAuthHeaders();
  const response = await axios.get(`${API_URL}/api/super-admin/me`, { headers });
  return response.data;
};

// ============================================
// DASHBOARD
// ============================================

export const getSuperAdminDashboard = async (): Promise<DashboardStats> => {
  const headers = await getAuthHeaders();
  const response = await axios.get(`${API_URL}/api/super-admin/dashboard`, { headers });
  return response.data;
};

// ============================================
// CHAINS
// ============================================

export const getChains = async (params?: {
  page?: number;
  limit?: number;
  search?: string;
  includeInactive?: boolean;
}): Promise<{ chains: Chain[]; pagination: PaginatedResponse<Chain>['pagination'] }> => {
  const headers = await getAuthHeaders();
  const response = await axios.get(`${API_URL}/api/super-admin/chains`, {
    headers,
    params: {
      page: params?.page || 1,
      limit: params?.limit || 50,
      search: params?.search || '',
      includeInactive: params?.includeInactive ? 'true' : 'false',
    },
  });
  return response.data;
};

export const getChain = async (chainId: number): Promise<Chain> => {
  const headers = await getAuthHeaders();
  const response = await axios.get(`${API_URL}/api/super-admin/chains/${chainId}`, { headers });
  return response.data;
};

export const createChain = async (data: { chain_name: string }): Promise<Chain> => {
  const headers = await getAuthHeaders();
  const response = await axios.post(`${API_URL}/api/super-admin/chains`, data, { headers });
  return response.data;
};

export const updateChain = async (
  chainId: number,
  data: { chain_name: string; is_active?: boolean }
): Promise<Chain> => {
  const headers = await getAuthHeaders();
  const response = await axios.put(`${API_URL}/api/super-admin/chains/${chainId}`, data, { headers });
  return response.data;
};

export const deleteChain = async (chainId: number): Promise<{ success: boolean; message: string; chain: Chain }> => {
  const headers = await getAuthHeaders();
  const response = await axios.delete(`${API_URL}/api/super-admin/chains/${chainId}`, { headers });
  return response.data;
};

export const restoreChain = async (chainId: number): Promise<{ success: boolean; message: string; chain: Chain }> => {
  const headers = await getAuthHeaders();
  const response = await axios.post(`${API_URL}/api/super-admin/chains/${chainId}/restore`, {}, { headers });
  return response.data;
};

// ============================================
// STORES
// ============================================

export const getStores = async (params?: {
  page?: number;
  limit?: number;
  search?: string;
  chainId?: number;
  includeInactive?: boolean;
}): Promise<{ stores: Store[]; pagination: PaginatedResponse<Store>['pagination'] }> => {
  const headers = await getAuthHeaders();
  const response = await axios.get(`${API_URL}/api/super-admin/stores`, {
    headers,
    params: {
      page: params?.page || 1,
      limit: params?.limit || 50,
      search: params?.search || '',
      chainId: params?.chainId,
      includeInactive: params?.includeInactive ? 'true' : 'false',
    },
  });
  return response.data;
};

export const getStoresByChain = async (
  chainId: number,
  includeInactive = false
): Promise<{ stores: Store[] }> => {
  const headers = await getAuthHeaders();
  const response = await axios.get(`${API_URL}/api/super-admin/chains/${chainId}/stores`, {
    headers,
    params: { includeInactive: includeInactive ? 'true' : 'false' },
  });
  return response.data;
};

export const getStore = async (storeId: number): Promise<Store> => {
  const headers = await getAuthHeaders();
  const response = await axios.get(`${API_URL}/api/super-admin/stores/${storeId}`, { headers });
  return response.data;
};

export const createStore = async (data: {
  chain_id: number;
  store_name: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  phone?: string;
}): Promise<Store> => {
  const headers = await getAuthHeaders();
  const response = await axios.post(`${API_URL}/api/super-admin/stores`, data, { headers });
  return response.data;
};

export const updateStore = async (
  storeId: number,
  data: {
    chain_id?: number;
    store_name: string;
    address?: string;
    city?: string;
    state?: string;
    zip_code?: string;
    phone?: string;
    is_active?: boolean;
  }
): Promise<Store> => {
  const headers = await getAuthHeaders();
  const response = await axios.put(`${API_URL}/api/super-admin/stores/${storeId}`, data, { headers });
  return response.data;
};

export const deleteStore = async (storeId: number): Promise<{ success: boolean; message: string; store: Store }> => {
  const headers = await getAuthHeaders();
  const response = await axios.delete(`${API_URL}/api/super-admin/stores/${storeId}`, { headers });
  return response.data;
};

export const restoreStore = async (storeId: number): Promise<{ success: boolean; message: string; store: Store }> => {
  const headers = await getAuthHeaders();
  const response = await axios.post(`${API_URL}/api/super-admin/stores/${storeId}/restore`, {}, { headers });
  return response.data;
};

// ============================================
// ADMIN USERS
// ============================================

export const getAdminUsers = async (): Promise<{ admins: AdminUser[] }> => {
  const headers = await getAuthHeaders();
  const response = await axios.get(`${API_URL}/api/super-admin/admins`, { headers });
  return response.data;
};

export const createAdminUser = async (data: {
  firebase_uid: string;
  email: string;
  display_name?: string;
  is_super_admin?: boolean;
  chain_id?: number;
}): Promise<AdminUser> => {
  const headers = await getAuthHeaders();
  const response = await axios.post(`${API_URL}/api/super-admin/admins`, data, { headers });
  return response.data;
};

export const updateAdminUser = async (
  userId: number,
  data: {
    display_name?: string;
    is_super_admin?: boolean;
    chain_id?: number | null;
  }
): Promise<AdminUser> => {
  const headers = await getAuthHeaders();
  const response = await axios.put(`${API_URL}/api/super-admin/admins/${userId}`, data, { headers });
  return response.data;
};

export const deleteAdminUser = async (userId: number): Promise<{ success: boolean; message: string; admin: AdminUser }> => {
  const headers = await getAuthHeaders();
  const response = await axios.delete(`${API_URL}/api/super-admin/admins/${userId}`, { headers });
  return response.data;
};

// ============================================
// ADMIN INVITES
// ============================================

export interface AdminInvite {
  invite_id: number;
  email: string;
  is_super_admin: boolean;
  chain_id: number | null;
  chain_name?: string | null;
  invited_by_email?: string | null;
  created_at: string;
  accepted_at: string | null;
}

export const getAdminInvites = async (status?: 'pending' | 'accepted' | 'all'): Promise<{ invites: AdminInvite[] }> => {
  const headers = await getAuthHeaders();
  const response = await axios.get(`${API_URL}/api/super-admin/invites`, {
    headers,
    params: { status: status || 'all' },
  });
  return response.data;
};

export const createAdminInvite = async (data: {
  email: string;
  is_super_admin?: boolean;
  chain_id?: number;
}): Promise<AdminInvite> => {
  const headers = await getAuthHeaders();
  const response = await axios.post(`${API_URL}/api/super-admin/invites`, data, { headers });
  return response.data;
};

export const sendInviteMagicLink = async (data: {
  email: string;
  is_super_admin?: boolean;
  chain_id?: number;
}): Promise<AdminInvite & { message: string }> => {
  const headers = await getAuthHeaders();
  const response = await axios.post(`${API_URL}/api/super-admin/invites/send-link`, data, { headers });
  return response.data;
};

export const deleteAdminInvite = async (inviteId: number): Promise<{ success: boolean; message: string; invite: AdminInvite }> => {
  const headers = await getAuthHeaders();
  const response = await axios.delete(`${API_URL}/api/super-admin/invites/${inviteId}`, { headers });
  return response.data;
};
