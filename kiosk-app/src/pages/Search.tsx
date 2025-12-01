import { useNavigate } from 'react-router-dom';
import SearchBar from '@/components/SearchBar';
import { Store } from 'lucide-react';

const Search = () => {
  const navigate = useNavigate();

  const handleSearch = (query: string) => {
    navigate(`/results?q=${encodeURIComponent(query)}`);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8">
      <div className="w-full max-w-4xl space-y-12 animate-in fade-in duration-500">
        {/* Logo/Branding */}
        <div className="text-center space-y-4">
          <div className="flex justify-center mb-6">
            <div className="h-24 w-24 bg-primary rounded-2xl flex items-center justify-center shadow-xl">
              <Store className="h-14 w-14 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-5xl font-bold text-foreground">Store Product Finder</h1>
          <p className="text-2xl text-muted-foreground">Find any product in seconds</p>
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
