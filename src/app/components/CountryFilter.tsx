import { Input } from './ui/input';
import { Search } from 'lucide-react';

interface CountryFilterProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export function CountryFilter({ searchQuery, onSearchChange }: CountryFilterProps) {
  return (
    <div className="w-full md:w-[240px]">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-foreground opacity-40" />
        <Input
          type="text"
          placeholder="Поиск по стране..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10 h-9 border-[#E5E5E5] dark:border-border text-sm py-2"
        />
      </div>
    </div>
  );
}