import { useState, useEffect, useRef } from 'react';
import { Input } from './ui/input';
import { Loader2 } from 'lucide-react';
import { searchCompanies, DadataCompany } from '../lib/dadata';

interface CompanyAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  onSelect?: (data: {
    company: string;
    inn: string;
    address: string;
  }) => void;
}

export function CompanyAutocomplete({ value, onChange, error, onSelect }: CompanyAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<DadataCompany[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (value.length < 2) {
        setSuggestions([]);
        return;
      }

      setIsLoading(true);
      try {
        const results = await searchCompanies(value);
        setSuggestions(results);
        if (results.length > 0) {
          setIsOpen(true);
        }
      } catch (err) {
        console.error('Failed to fetch company suggestions:', err);
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    };

    const timeoutId = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(timeoutId);
  }, [value]);

  const handleSelect = (company: DadataCompany) => {
    const companyName = company.data.name.short_with_opf || company.data.name.full_with_opf;
    onChange(companyName);
    
    // Автоматически заполняем адрес, если передан callback
    if (onSelect && company.data.address?.value) {
      onSelect({
        company: companyName,
        inn: company.data.inn,
        address: company.data.address.value,
      });
    }
    
    setIsOpen(false);
    setSuggestions([]);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="ООО «Название компании»"
          className={error ? 'border-destructive pr-10' : 'pr-10'}
          onFocus={() => {
            if (suggestions.length > 0) {
              setIsOpen(true);
            }
          }}
        />
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      {isOpen && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-[300px] overflow-auto">
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              type="button"
              onClick={() => handleSelect(suggestion)}
              className="w-full px-4 py-3 text-left hover:bg-accent hover:text-accent-foreground transition-colors border-b border-border last:border-b-0"
            >
              <div className="text-sm text-foreground">
                {suggestion.data.name.short_with_opf || suggestion.data.name.full_with_opf}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                ИНН: {suggestion.data.inn}
                {suggestion.data.kpp && ` • КПП: ${suggestion.data.kpp}`}
              </div>
              {suggestion.data.address?.value && (
                <div className="text-xs text-muted-foreground mt-1">
                  {suggestion.data.address.value}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}