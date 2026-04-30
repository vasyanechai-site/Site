import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

interface PriceSortProps {
  sortOrder: string;
  onSortChange: (order: string) => void;
}

export function PriceSort({ sortOrder, onSortChange }: PriceSortProps) {
  return (
    <div className="w-full md:w-[240px]">
      <Select value={sortOrder} onValueChange={onSortChange}>
        <SelectTrigger className="h-9 border-border text-sm">
          <SelectValue placeholder="Сортировка по цене" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="default">Цена: по умолчанию</SelectItem>
          <SelectItem value="asc">Цена: по возрастанию</SelectItem>
          <SelectItem value="desc">Цена: по убыванию</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}