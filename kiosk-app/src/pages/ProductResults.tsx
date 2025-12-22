import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import SearchBar from '@/components/SearchBar';
import StoreMap from '@/components/StoreMap';
import ProductDetails from '@/components/ProductDetails';
import { Button } from '@/components/ui/button';
import { searchProducts } from '@/api/products';
import { Product } from '@/data/products';
import { toast } from 'sonner';

const ProductResults = () => {
  const [loading, setLoading] = useState(false);
  const [searchParams] = useSearchParams();
  const { storeId } = useParams<{ storeId: string }>();
  const navigate = useNavigate();
  const query = searchParams.get('q') || '';

  const [results, setResults] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  useEffect(() => {
    const fetchProducts = async () => {
      if (!query || !storeId) return;

      setLoading(true);
      try {
        const searchResults = await searchProducts(query, storeId);
        setResults(searchResults);

        if (searchResults.length > 0) {
          setSelectedProduct(searchResults[0]);
          toast.success(`Found ${searchResults.length} product${searchResults.length > 1 ? 's' : ''}`);
        } else {
          toast.error('No products found');
        }
      } catch (error) {
        console.error('Search error:', error);
        toast.error('Failed to search products');
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [query, storeId]);

  const handleNewSearch = (newQuery: string) => {
    navigate(`/kiosk/${storeId}/results?q=${encodeURIComponent(newQuery)}`);
  };

  // Show loading spinner while searching
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="border-b-2 border-border bg-card shadow-md">
          <div className="container mx-auto px-8 py-6">
            <Button
              variant="ghost"
              size="lg"
              onClick={() => navigate('/')}
              className="mb-4 text-lg h-12"
            >
              <ArrowLeft className="mr-2 h-6 w-6" />
              Back to Search
            </Button>
            <SearchBar onSearch={handleNewSearch} initialValue={query} />
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
            <p className="text-xl text-muted-foreground">Searching for products...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show "No products found" only after loading completes
  if (!query || results.length === 0) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="border-b-2 border-border bg-card shadow-md">
          <div className="container mx-auto px-8 py-6">
            <Button
              variant="ghost"
              size="lg"
              onClick={() => navigate('/')}
              className="mb-4 text-lg h-12"
            >
              <ArrowLeft className="mr-2 h-6 w-6" />
              Back to Search
            </Button>
            <SearchBar onSearch={handleNewSearch} initialValue={query} />
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center space-y-4">
            <h2 className="text-3xl font-bold text-foreground">No products found</h2>
            <p className="text-xl text-muted-foreground">Try searching for something else</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Bar with Search */}
      <div className="border-b-2 border-border bg-card shadow-md">
        <div className="container mx-auto px-8 py-6">
          <Button
            variant="ghost"
            size="lg"
            onClick={() => navigate(`/kiosk/${storeId}`)}
            className="mb-4 text-lg h-12"
          >
            <ArrowLeft className="mr-2 h-6 w-6" />
            Back to Search
          </Button>
          <SearchBar onSearch={handleNewSearch} initialValue={query} />
          
          {results.length > 1 && (
            <div className="mt-4 flex flex-wrap gap-3">
              {results.map((product) => (
                <Button
                  key={product.id}
                  variant={selectedProduct?.id === product.id ? 'default' : 'outline'}
                  size="lg"
                  onClick={() => setSelectedProduct(product)}
                  className="text-base h-12 rounded-xl"
                >
                  {product.name}
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 container mx-auto p-8">
        <div className="grid grid-cols-1 lg:grid-cols-[60%_40%] gap-8 h-[calc(100vh-16rem)]">
          {/* Left: Store Map */}
          <StoreMap storeId={storeId ? parseInt(storeId) : 1} selectedProduct={selectedProduct} />
          
          {/* Right: Product Details */}
          {selectedProduct && <ProductDetails product={selectedProduct} />}
        </div>
      </div>
    </div>
  );
};

export default ProductResults;
