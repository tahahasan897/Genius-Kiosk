import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { getStores, getChains, type Store, type Chain } from '@/api/stores';
import { useAuth } from '@/contexts/AuthContext';

interface StoreContextType {
  // Current selection
  currentChainId: number | null;
  currentStoreId: number | null;
  currentStore: Store | null;
  currentChain: Chain | null;

  // Available options
  chains: Chain[];
  stores: Store[];

  // Actions
  setCurrentChainId: (chainId: number) => void;
  setCurrentStoreId: (storeId: number) => void;

  // Loading state
  loading: boolean;
  error: string | null;

  // Refresh
  refreshStores: () => Promise<void>;
}

const StoreContext = createContext<StoreContextType | null>(null);

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
};

interface StoreProviderProps {
  children: ReactNode;
}

const STORAGE_KEY_CHAIN = 'selectedChainId';
const STORAGE_KEY_STORE = 'selectedStoreId';

export const StoreProvider = ({ children }: StoreProviderProps) => {
  const { user, loading: authLoading } = useAuth();
  const [chains, setChains] = useState<Chain[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [currentChainId, setCurrentChainIdState] = useState<number | null>(null);
  const [currentStoreId, setCurrentStoreIdState] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Derived state
  const currentStore = stores.find(s => s.store_id === currentStoreId) || null;
  const currentChain = chains.find(c => c.chain_id === currentChainId) || null;

  // Load chains and stores on mount
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [chainsData, storesData] = await Promise.all([
        getChains(),
        getStores(),
      ]);
      setChains(chainsData);
      setStores(storesData);

      // Restore from localStorage or use first available
      const savedChainId = localStorage.getItem(STORAGE_KEY_CHAIN);
      const savedStoreId = localStorage.getItem(STORAGE_KEY_STORE);

      if (savedChainId && chainsData.some(c => c.chain_id === parseInt(savedChainId))) {
        setCurrentChainIdState(parseInt(savedChainId));
      } else if (chainsData.length > 0) {
        setCurrentChainIdState(chainsData[0].chain_id);
      }

      if (savedStoreId && storesData.some(s => s.store_id === parseInt(savedStoreId))) {
        setCurrentStoreIdState(parseInt(savedStoreId));
      } else if (storesData.length > 0) {
        setCurrentStoreIdState(storesData[0].store_id);
      }
    } catch (err) {
      console.error('Error fetching store data:', err);
      setError('Failed to load store data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Only fetch when auth is ready and user is logged in
    if (!authLoading && user) {
      fetchData();
    } else if (!authLoading && !user) {
      // Clear data when user logs out
      setChains([]);
      setStores([]);
      setCurrentChainIdState(null);
      setCurrentStoreIdState(null);
      setLoading(false);
    }
  }, [user, authLoading]);

  const setCurrentChainId = (chainId: number) => {
    setCurrentChainIdState(chainId);
    localStorage.setItem(STORAGE_KEY_CHAIN, chainId.toString());

    // Auto-select first store in the new chain
    const chainStores = stores.filter(s => s.chain_id === chainId);
    if (chainStores.length > 0) {
      setCurrentStoreId(chainStores[0].store_id);
    }
  };

  const setCurrentStoreId = (storeId: number) => {
    setCurrentStoreIdState(storeId);
    localStorage.setItem(STORAGE_KEY_STORE, storeId.toString());

    // Also update chain if store belongs to different chain
    const store = stores.find(s => s.store_id === storeId);
    if (store && store.chain_id !== currentChainId) {
      setCurrentChainIdState(store.chain_id);
      localStorage.setItem(STORAGE_KEY_CHAIN, store.chain_id.toString());
    }
  };

  const value: StoreContextType = {
    currentChainId,
    currentStoreId,
    currentStore,
    currentChain,
    chains,
    stores,
    setCurrentChainId,
    setCurrentStoreId,
    loading,
    error,
    refreshStores: fetchData,
  };

  return (
    <StoreContext.Provider value={value}>
      {children}
    </StoreContext.Provider>
  );
};
