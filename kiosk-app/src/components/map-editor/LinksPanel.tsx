import { useState, useEffect, useCallback } from 'react';
import { Search, Link, Unlink, CheckSquare, Square, Loader2, Package } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import type { MapElement } from './types';

interface LinksPanelProps {
  element: MapElement | null;
  storeId: number;
  onLinksChanged?: () => void; // Callback when product links are modified
}

interface ProductWithLink {
  product_id: number;
  sku: string;
  product_name: string;
  category: string;
  base_price: number;
  image_url: string | null;
  aisle: string | null;
  shelf: string | null;
  is_linked: boolean;
  link_id: number | null;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const LinksPanel = ({ element, storeId, onLinksChanged }: LinksPanelProps) => {
  const [products, setProducts] = useState<ProductWithLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [processingProductId, setProcessingProductId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [linkedCount, setLinkedCount] = useState(0);

  // Check if element is a smart pin
  const isSmartPin = element?.type === 'smart-pin';

  // Fetch products with link status
  const fetchProducts = useCallback(async () => {
    if (!element?.id || !isSmartPin) return;

    setLoading(true);
    try {
      const params = new URLSearchParams({
        search: searchQuery,
        limit: '100',
      });
      
      // Ensure element.id is converted to string for the URL
      // For newly created elements, the ID might be a timestamp string
      // We need to check if it's a valid database ID or wait for it to be saved
      const pinId = String(element.id);
      
      // Check if this is a temporary ID (timestamp-based) vs database ID
      // Temporary IDs are typically long numeric strings, database IDs are usually shorter integers
      // But we'll try the API call anyway and handle errors gracefully
      
      const response = await fetch(
        `${API_URL}/api/admin/stores/${storeId}/pins/${pinId}/products/all?${params}`
      );
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || 'Failed to fetch products';

        // If pin not found, it might be a new element that is still being saved (auto-save in progress)
        // Just show empty products and wait for the next fetch cycle
        if (response.status === 404 || errorMessage.includes('not found') || errorMessage.includes('Pin not found') || errorMessage.includes('save your map')) {
          setProducts([]);
          setLinkedCount(0);
          // Don't show error - auto-save should complete shortly
          return;
        }

        throw new Error(errorMessage);
      }

      const data = await response.json();
      setProducts(data.products || []);
      setLinkedCount((data.products || []).filter((p: ProductWithLink) => p.is_linked).length);
    } catch (error: any) {
      console.error('Error fetching products:', error);
      // Only show error if it's not a "not found" error (which is expected for unsaved pins)
      if (!error.message?.includes('not found') && !error.message?.includes('Pin not found')) {
        toast.error(error.message || 'Failed to load products');
      } else {
        // Silently handle unsaved pins
        setProducts([]);
        setLinkedCount(0);
      }
    } finally {
      setLoading(false);
    }
  }, [element?.id, storeId, searchQuery, isSmartPin]);

  // Fetch products when element changes or search query changes
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      fetchProducts();
    }, 300);
    
    return () => clearTimeout(debounceTimer);
  }, [fetchProducts]);

  // Toggle product link
  const toggleProductLink = async (product: ProductWithLink) => {
    if (!element?.id) {
      toast.error('No pin selected');
      return;
    }

    // Check if pin needs to be saved first
    const pinId = String(element.id);
    
    // Show immediate visual feedback by updating local state optimistically
    const wasLinked = product.is_linked;
    setProcessingProductId(product.product_id);
    setProducts(prev => 
      prev.map(p => 
        p.product_id === product.product_id 
          ? { ...p, is_linked: !wasLinked }
          : p
      )
    );
    setLinkedCount(prev => wasLinked ? prev - 1 : prev + 1);

    setSaving(true);
    try {
      if (wasLinked) {
        // Unlink
        const response = await fetch(
          `${API_URL}/api/admin/stores/${storeId}/pins/${pinId}/unlink`,
          {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productIds: [product.product_id] }),
          }
        );
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const errorMsg = errorData.error || 'Failed to unlink product';
        
          // Revert optimistic update on error
        setProducts(prev => 
          prev.map(p => 
            p.product_id === product.product_id 
                ? { ...p, is_linked: wasLinked }
              : p
          )
        );
          setLinkedCount(prev => wasLinked ? prev + 1 : prev - 1);
          
          throw new Error(errorMsg);
        }
        
        toast.success(`✓ Unlinked ${product.product_name}`);
        onLinksChanged?.(); // Notify parent that links have changed

        // Refresh the product list to get updated link status
        await fetchProducts();
      } else {
        // Link
        const response = await fetch(
          `${API_URL}/api/admin/stores/${storeId}/pins/${pinId}/link`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productIds: [product.product_id] }),
          }
        );
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const errorMsg = errorData.error || 'Failed to link product';
        
          // Revert optimistic update on error
        setProducts(prev => 
          prev.map(p => 
            p.product_id === product.product_id 
                ? { ...p, is_linked: wasLinked }
              : p
          )
        );
          setLinkedCount(prev => wasLinked ? prev + 1 : prev - 1);
          
          // Provide helpful error message
          if (errorMsg.includes('not found') || errorMsg.includes('Pin not found')) {
            throw new Error('Please save your map first, then try linking again.');
          }
          throw new Error(errorMsg);
        }
        
        toast.success(`✓ Linked ${product.product_name} to smart pin`);
        onLinksChanged?.(); // Notify parent that links have changed

        // Refresh the product list to get updated link status
        await fetchProducts();
      }
    } catch (error: any) {
      console.error('Error toggling link:', error);
      toast.error(error.message || 'Failed to update link');
    } finally {
      setSaving(false);
      setProcessingProductId(null);
    }
  };

  // Select all visible products
  const selectAll = async () => {
    if (!element?.id) return;

    const unlinkedProducts = products.filter(p => !p.is_linked);
    if (unlinkedProducts.length === 0) {
      toast.info('All visible products are already linked');
      return;
    }

    setSaving(true);
    try {
      const pinId = String(element.id);
      
      const response = await fetch(
        `${API_URL}/api/admin/stores/${storeId}/pins/${pinId}/link`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            productIds: unlinkedProducts.map(p => p.product_id) 
          }),
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to link products');
      }
      
      setProducts(prev =>
        prev.map(p => ({ ...p, is_linked: true }))
      );
      setLinkedCount(products.length);
      toast.success(`Linked ${unlinkedProducts.length} products`);
      onLinksChanged?.(); // Notify parent that links have changed
    } catch (error: any) {
      console.error('Error linking all:', error);
      toast.error(error.message || 'Failed to link products');
    } finally {
      setSaving(false);
    }
  };

  // Deselect all visible products
  const deselectAll = async () => {
    if (!element?.id) return;

    const linkedProducts = products.filter(p => p.is_linked);
    if (linkedProducts.length === 0) {
      toast.info('No products are linked');
      return;
    }

    setSaving(true);
    try {
      const pinId = String(element.id);
      
      const response = await fetch(
        `${API_URL}/api/admin/stores/${storeId}/pins/${pinId}/unlink`,
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            productIds: linkedProducts.map(p => p.product_id) 
          }),
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to unlink products');
      }
      
      setProducts(prev =>
        prev.map(p => ({ ...p, is_linked: false, link_id: null }))
      );
      setLinkedCount(0);
      toast.success(`Unlinked ${linkedProducts.length} products`);
      onLinksChanged?.(); // Notify parent that links have changed
    } catch (error: any) {
      console.error('Error unlinking all:', error);
      toast.error(error.message || 'Failed to unlink products');
    } finally {
      setSaving(false);
    }
  };

  // If no element is selected or it's not a smart pin
  if (!element) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-4 text-center">
        <Link className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-sm text-muted-foreground">
          Select an element to manage product links
        </p>
      </div>
    );
  }


  if (!isSmartPin) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-4 text-center">
        <Package className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-sm font-medium mb-2">Not a Smart Pin</p>
        <p className="text-xs text-muted-foreground">
          Only Smart Pins can be linked to products. Select a Smart Pin or drag one onto the canvas.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border space-y-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-sm">Product Links</h3>
            <p className="text-xs text-muted-foreground">
              {linkedCount} product{linkedCount !== 1 ? 's' : ''} linked
            </p>
          </div>
          <Badge variant={linkedCount > 0 ? 'default' : 'secondary'}>
            {linkedCount}
          </Badge>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        {/* Bulk actions */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 h-8 text-xs"
            onClick={selectAll}
            disabled={saving || loading}
          >
            <CheckSquare className="h-3 w-3 mr-1" />
            Select All
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 h-8 text-xs"
            onClick={deselectAll}
            disabled={saving || loading}
          >
            <Square className="h-3 w-3 mr-1" />
            Deselect All
          </Button>
        </div>
      </div>

      {/* Product list */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">
                {searchQuery ? 'No products found' : 'No products available'}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {products.map((product) => (
                <div
                  key={product.product_id}
                  className={`
                    flex items-center gap-3 p-2 rounded-lg transition-all duration-200 relative
                    ${processingProductId === product.product_id ? 'opacity-60 cursor-wait' : ''}
                    ${processingProductId !== product.product_id ? 'cursor-pointer hover:bg-muted/70 hover:scale-[1.01]' : 'cursor-not-allowed'}
                    ${product.is_linked
                      ? 'bg-primary/10 border border-primary/30 shadow-sm'
                      : 'border border-transparent hover:border-border'
                    }
                  `}
                  onClick={() => {
                    if (processingProductId === product.product_id || saving) return;
                    toggleProductLink(product);
                  }}
                >
                  {processingProductId === product.product_id ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary flex-shrink-0" />
                  ) : (
                  <Checkbox
                    checked={product.is_linked}
                    disabled={saving || processingProductId === product.product_id}
                    className="pointer-events-none"
                    onCheckedChange={() => {
                      // Prevent checkbox from being toggled directly - use the row click instead
                    }}
                  />
                  )}
                  
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.product_name}
                      className="h-10 w-10 rounded object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded bg-muted flex items-center justify-center flex-shrink-0">
                      <Package className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {product.product_name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {product.category}
                      {product.aisle && ` • ${product.aisle}${product.shelf ? `-${product.shelf}` : ''}`}
                    </p>
                  </div>
                  
                  <div className="text-xs text-muted-foreground flex-shrink-0">
                    ${Number(product.base_price).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Saving indicator */}
      {saving && (
        <div className="p-2 border-t border-border bg-muted/50 flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-xs">Saving...</span>
        </div>
      )}
    </div>
  );
};

export default LinksPanel;

