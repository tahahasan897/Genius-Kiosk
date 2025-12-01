import { useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface SearchBarProps {
  onSearch: (query: string) => void;
  initialValue?: string;
  large?: boolean;
}

const SearchBar = ({ onSearch, initialValue = '', large = false }: SearchBarProps) => {
  const [query, setQuery] = useState(initialValue);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="relative flex items-center gap-3">
        <div className="relative flex-1">
          <Search className={`absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground ${large ? 'h-8 w-8' : 'h-6 w-6'}`} />
          <Input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for any product..."
            className={`${large ? 'h-20 text-2xl pl-16 pr-6' : 'h-16 text-xl pl-14 pr-6'} rounded-2xl border-2 focus-visible:ring-2 focus-visible:ring-primary shadow-lg`}
          />
        </div>
        <Button
          type="submit"
          size="lg"
          className={`${large ? 'h-20 px-10 text-xl' : 'h-16 px-8 text-lg'} rounded-2xl shadow-lg`}
        >
          Search
        </Button>
      </div>
    </form>
  );
};

export default SearchBar;
