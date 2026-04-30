import { Label } from './ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

interface CategorySelectProps {
  categories: string[];
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
}

export function CategorySelect({ categories, selectedCategory, onCategoryChange }: CategorySelectProps) {
  if (categories.length === 0) return null;

  return (
    <div className="w-full md:w-[240px]">
      <Select value={selectedCategory} onValueChange={onCategoryChange}>
        <SelectTrigger className="h-9 border-border text-sm">
          <SelectValue placeholder="Все категории" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem key="all" value="all">Все категории</SelectItem>
          {categories.map((category) => (
            <SelectItem key={category} value={category}>
              {category}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}