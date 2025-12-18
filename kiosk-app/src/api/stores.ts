import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

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

// Get all chains
export const getChains = async (): Promise<Chain[]> => {
  const response = await axios.get(`${API_URL}/api/stores/chains`);
  return response.data;
};

// Get all stores (with chain info)
export const getStores = async (): Promise<Store[]> => {
  const response = await axios.get(`${API_URL}/api/stores`);
  return response.data;
};

// Get stores by chain ID
export const getStoresByChain = async (chainId: number): Promise<Store[]> => {
  const response = await axios.get(`${API_URL}/api/stores/chain/${chainId}`);
  return response.data;
};

// Get store by ID
export const getStoreById = async (storeId: number): Promise<Store> => {
  const response = await axios.get(`${API_URL}/api/stores/${storeId}`);
  return response.data;
};
