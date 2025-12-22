import { useStore } from '@/contexts/StoreContext';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Store, ChevronDown } from 'lucide-react';

interface StoreSelectorProps {
  showChainSelector?: boolean;
  hideIfSingleStore?: boolean;
  className?: string;
}

const StoreSelector = ({ showChainSelector = false, hideIfSingleStore = false, className = '' }: StoreSelectorProps) => {
  const {
    chains,
    stores,
    currentChainId,
    currentStoreId,
    currentStore,
    currentChain,
    setCurrentChainId,
    setCurrentStoreId,
    loading,
  } = useStore();

  if (loading) {
    return (
      <div className={`flex items-center gap-2 text-sm text-muted-foreground ${className}`}>
        <Store className="h-4 w-4 animate-pulse" />
        <span>Loading stores...</span>
      </div>
    );
  }

  // Filter stores by current chain if chain selector is shown
  const availableStores = showChainSelector && currentChainId
    ? stores.filter(s => s.chain_id === currentChainId)
    : stores;

  // If no stores available
  if (stores.length === 0) {
    return (
      <div className={`flex items-center gap-2 text-sm text-muted-foreground ${className}`}>
        <Store className="h-4 w-4" />
        <span>No stores available</span>
      </div>
    );
  }

  // Hide if only one store and hideIfSingleStore is true
  if (hideIfSingleStore && availableStores.length <= 1) {
    // Just show current store name without selector
    return (
      <div className={`flex items-center gap-2 text-sm ${className}`}>
        <Store className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">{currentStore?.store_name || 'No store'}</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Chain selector (optional) */}
      {showChainSelector && chains.length > 1 && (
        <Select
          value={currentChainId?.toString() || ''}
          onValueChange={(value) => setCurrentChainId(parseInt(value))}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select chain">
              {currentChain?.chain_name || 'Select chain'}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {chains.map((chain) => (
              <SelectItem key={chain.chain_id} value={chain.chain_id.toString()}>
                {chain.chain_name} ({chain.store_count} stores)
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Store selector */}
      <Select
        value={currentStoreId?.toString() || ''}
        onValueChange={(value) => setCurrentStoreId(parseInt(value))}
      >
        <SelectTrigger className="w-[200px]">
          <div className="flex items-center gap-2">
            <Store className="h-4 w-4" />
            <SelectValue placeholder="Select store">
              {currentStore?.store_name || 'Select store'}
            </SelectValue>
          </div>
        </SelectTrigger>
        <SelectContent>
          {availableStores.map((store) => (
            <SelectItem key={store.store_id} value={store.store_id.toString()}>
              <div className="flex flex-col">
                <span>{store.store_name}</span>
                {store.city && (
                  <span className="text-xs text-muted-foreground">
                    {store.city}, {store.state}
                  </span>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default StoreSelector;
