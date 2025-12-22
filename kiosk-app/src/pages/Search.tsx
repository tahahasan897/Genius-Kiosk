import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import SearchBar from '@/components/SearchBar';
import { Store, ArrowLeft, Loader2 } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface StoreInfo {
  store_id: number;
  store_name: string;
  chain_name: string;
}

const Search = () => {
  const navigate = useNavigate();
  const { storeId } = useParams<{ storeId: string }>();
  const [storeInfo, setStoreInfo] = useState<StoreInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStoreInfo = async () => {
      if (!storeId) {
        setError('No store ID provided');
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`${API_URL}/api/products/store/${storeId}/info`);
        if (response.ok) {
          const data = await response.json();
          setStoreInfo(data);
        } else {
          setError('Store not found');
        }
      } catch (err) {
        console.error('Failed to fetch store info:', err);
        setError('Failed to load store information');
      } finally {
        setLoading(false);
      }
    };

    fetchStoreInfo();
  }, [storeId]);

  const handleSearch = (query: string) => {
    navigate(`/kiosk/${storeId}/results?q=${encodeURIComponent(query)}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <Store className="h-16 w-16 mx-auto text-muted-foreground" />
          <h1 className="text-2xl font-bold text-foreground">{error}</h1>
          <Link to="/" className="text-primary hover:underline">
            ← Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8">
      {/* Back to Home Link */}
      <Link
        to="/"
        className="absolute top-6 left-6 flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Back to Home</span>
      </Link>

      <div className="w-full max-w-4xl space-y-12 animate-in fade-in duration-500">
        {/* Logo/Branding */}
        <div className="text-center space-y-4">
          <div className="flex justify-center mb-6">
            <div className="h-24 w-24 bg-primary rounded-2xl flex items-center justify-center shadow-xl">
              <Store className="h-14 w-14 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-5xl font-bold text-foreground">{storeInfo?.store_name || 'Store'}</h1>
          <p className="text-2xl text-muted-foreground">
            {storeInfo?.chain_name ? `${storeInfo.chain_name} • ` : ''}Find any product in seconds
          </p>
        </div>

        {/* Search Bar */}
        <div className="space-y-6">
          <SearchBar onSearch={handleSearch} large />
          
          {/* Quick Tips */}
          <div className="bg-card rounded-2xl p-6 border-2 border-border shadow-lg">
            <h3 className="text-lg font-semibold text-foreground mb-3">Quick Tips:</h3>
            <ul className="space-y-2 text-base text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold">•</span>
                <span>Search by product name, category, or description</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold">•</span>
                <span>Get exact aisle and shelf locations</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold">•</span>
                <span>Check real-time stock availability</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Search;
