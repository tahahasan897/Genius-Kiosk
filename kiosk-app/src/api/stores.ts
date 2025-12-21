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

export interface Chain {
  chain_id: number;
  chain_name: string;
  created_at: string;
  store_count: number;
}

export interface Store {
  store_id: number;
  chain_id: number;
  chain_name: string;
  store_name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  is_active: boolean;
  created_at: string;
  map_image_url: string | null;
}

// Get all chains (filtered by admin's access)
export const getChains = async (): Promise<Chain[]> => {
  const headers = getAuthHeaders();
  const response = await axios.get(`${API_URL}/api/stores/chains`, { headers });
  return response.data;
};

// Get all stores (filtered by admin's access)
export const getStores = async (): Promise<Store[]> => {
  const headers = getAuthHeaders();
  const response = await axios.get(`${API_URL}/api/stores`, { headers });
  return response.data;
};

// Get stores by chain ID
export const getStoresByChain = async (chainId: number): Promise<Store[]> => {
  const headers = getAuthHeaders();
  const response = await axios.get(`${API_URL}/api/stores/chain/${chainId}`, { headers });
  return response.data;
};

// Get store by ID
export const getStoreById = async (storeId: number): Promise<Store> => {
  const headers = getAuthHeaders();
  const response = await axios.get(`${API_URL}/api/stores/${storeId}`, { headers });
  return response.data;
};
