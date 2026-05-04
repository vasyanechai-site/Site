import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { CoffeeItem } from '../types';
import { fetchCoffeeItemsAdmin, createCoffeeItem, updateCoffeeItem, deleteCoffeeItem, fetchExchangeRate, updateExchangeRate, reorderCoffeeItems } from '../lib/api';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Plus, Pencil, Trash2, Loader2, DollarSign, Save, GripVertical } from 'lucide-react';
import { FadeIn } from './ui/fade-in';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import { toast } from 'sonner';

// Drag and Drop Types
const ItemType = 'COFFEE_ITEM';

interface DraggableRowProps {
  item: CoffeeItem;
  index: number;
  category: string;
  moveRow: (dragIndex: number, hoverIndex: number, category: string) => void;
  onDrop: () => void;
  openEditDialog: (item: CoffeeItem) => void;
  setDeleteItemId: (id: string) => void;
  isColdBrew?: boolean;
}

const DraggableRow = ({ item, index, category, moveRow, onDrop, openEditDialog, setDeleteItemId, isColdBrew }: DraggableRowProps) => {
  const ref = useRef<HTMLTableRowElement>(null);

  const [{ handlerId }, drop] = useDrop({
    accept: ItemType,
    collect(monitor) {
      return { handlerId: monitor.getHandlerId() };
    },
    hover(dragItem: any, monitor) {
      if (!ref.current) return;
      // Запрещаем перетаскивание между категориями
      if (dragItem.category !== category) return;

      const dragIndex = dragItem.index;
      const hoverIndex = index;

      if (dragIndex === hoverIndex) return;

      const hoverBoundingRect = ref.current.getBoundingClientRect();
      const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
      const clientOffset = monitor.getClientOffset();
      if (!clientOffset) return;
      const hoverClientY = clientOffset.y - hoverBoundingRect.top;

      if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) return;
      if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) return;

      moveRow(dragIndex, hoverIndex, category);
      dragItem.index = hoverIndex;
    },
    drop() {
      onDrop();
    }
  });

  const [{ isDragging }, drag, preview] = useDrag({
    type: ItemType,
    item: () => ({ id: item.id, index, category }),
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  drag(drop(ref));

  return (
    <tr
      ref={ref}
      data-handler-id={handlerId}
      className={`border-b border-border transition-opacity ${isDragging ? 'opacity-40' : 'opacity-100'}`}
    >
      <td className="px-3 py-4 text-muted-foreground cursor-grab active:cursor-grabbing">
        <GripVertical className="w-4 h-4" />
      </td>
      <td className="px-6 py-4 text-foreground font-medium">{item.name}</td>
      <td className="px-6 py-4 text-muted-foreground text-sm">{item.country}</td>
      <td className="px-6 py-4 text-muted-foreground text-sm">{item.process}</td>
      <td className="px-6 py-4 text-muted-foreground text-sm">{item.category}</td>
      <td className="px-6 py-4">
        {item.published !== false ? (
          <Badge variant="default" className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20 hover:bg-green-500/20">
            Опубликован
          </Badge>
        ) : (
          <Badge variant="secondary" className="bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20">
            Скрыт
          </Badge>
        )}
      </td>
      <td className="px-6 py-4 text-right text-foreground text-sm whitespace-nowrap">
        ${item.price_usd_kg ? item.price_usd_kg.toFixed(2) : '—'}
      </td>
      {!isColdBrew && (
        <td className="px-6 py-4 text-right text-foreground text-sm whitespace-nowrap">
          ${item.price_usd_200 ? item.price_usd_200.toFixed(2) : '—'}
        </td>
      )}
      <td className="px-6 py-4 text-right text-foreground text-sm whitespace-nowrap font-medium">{item.price_kg.toLocaleString('ru-RU')} ₽</td>
      {!isColdBrew && (
        <td className="px-6 py-4 text-right text-foreground text-sm whitespace-nowrap font-medium">{item.price_200.toLocaleString('ru-RU')} ₽</td>
      )}
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => openEditDialog(item)}
          >
            <Pencil className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-red-200 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 hover:border-red-300 dark:border-red-900/30 dark:bg-red-950/10 dark:text-red-400 dark:hover:bg-red-950/30 dark:hover:text-red-300"
            onClick={() => setDeleteItemId(item.id)}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </td>
    </tr>
  );
};

// Простая строка без DnD (для мобильных)
const StaticRow = ({ item, openEditDialog, setDeleteItemId }: { item: CoffeeItem; openEditDialog: (item: CoffeeItem) => void; setDeleteItemId: (id: string) => void }) => (
  <tr className="border-b border-border">
    <td className="px-4 py-3 text-foreground font-medium text-sm">{item.name}</td>
    <td className="px-4 py-3 text-muted-foreground text-xs">{item.country} / {item.process}</td>
    <td className="px-4 py-3 text-muted-foreground text-xs">{item.category}</td>
    <td className="px-4 py-3">
      {item.published !== false ? (
        <Badge variant="default" className="bg-green-500/10 text-green-700 border-green-500/20 text-xs">Опубл.</Badge>
      ) : (
        <Badge variant="secondary" className="bg-gray-500/10 text-gray-600 border-gray-500/20 text-xs">Скрыт</Badge>
      )}
    </td>
    <td className="px-4 py-3 text-right text-foreground text-xs whitespace-nowrap font-medium">{item.price_kg.toLocaleString('ru-RU')} ₽</td>
    <td className="px-4 py-3 whitespace-nowrap">
      <div className="flex items-center justify-center gap-1">
        <Button variant="outline" size="sm" onClick={() => openEditDialog(item)}>
          <Pencil className="w-3 h-3" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
          onClick={() => setDeleteItemId(item.id)}
        >
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>
    </td>
  </tr>
);

export function PriceManagement() {
  const [items, setItems] = useState<CoffeeItem[]>([]);
  const itemsRef = useRef<CoffeeItem[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CoffeeItem | null>(null);
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [categoryError, setCategoryError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Курс доллара
  const [exchangeRate, setExchangeRate] = useState(95);
  const [isEditingRate, setIsEditingRate] = useState(false);
  const [tempRate, setTempRate] = useState('95');
  const [isSavingRate, setIsSavingRate] = useState(false);

  // Определяем тач-устройство (мобильный/планшет)
  const isMobile = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  }, []);

  const [formData, setFormData] = useState<{
    type: 'grain' | 'drip' | 'coldbrew';
    name: string;
    country: string;
    process: string;
    category: string;
    descriptors: string;
    qScore: string;
    badge: 'new' | 'hit' | 'rare' | 'favorite' | 'soldout' | 'comingsoon' | '';
    price_usd_kg: string;
    price_usd_200: string;
    published: boolean;
    no_discount: boolean;
  }>({
    type: 'grain',
    name: '',
    country: '',
    process: '',
    category: '',
    descriptors: '',
    qScore: '',
    badge: '',
    price_usd_kg: '',
    price_usd_200: '',
    published: true,
    no_discount: false,
  });

  useEffect(() => {
    loadItems();
    loadExchangeRate();
  }, []);

  /** Всегда актуальный список для сохранения порядка (избегаем stale closure в handleDropSave → reorder). */
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const loadExchangeRate = async () => {
    try {
      const rate = await fetchExchangeRate();
      setExchangeRate(rate);
      setTempRate(rate.toString());
    } catch (error) {
      console.error('Failed to load exchange rate:', error);
    }
  };

  const handleSaveExchangeRate = async () => {
    try {
      setIsSavingRate(true);
      const rate = parseFloat(tempRate);
      if (isNaN(rate) || rate <= 0) {
        toast.error('Неверное значение курса');
        return;
      }
      await updateExchangeRate(rate);
      setExchangeRate(rate);
      setIsEditingRate(false);
      toast.success('Курс обновлен. Все цены пересчитаны!');
      await loadItems();
    } catch (error) {
      console.error('Failed to update exchange rate:', error);
      toast.error('Ошибка обновления курса');
    } finally {
      setIsSavingRate(false);
    }
  };

  const loadItems = async () => {
    try {
      setIsLoading(true);
      const coffeeItems = await fetchCoffeeItemsAdmin();
      setItems(coffeeItems);
      itemsRef.current = coffeeItems;
    } catch (error) {
      console.error('Failed to load coffee items:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      type: 'grain',
      name: '',
      country: '',
      process: '',
      category: '',
      descriptors: '',
      qScore: '',
      badge: '',
      price_usd_kg: '',
      price_usd_200: '',
      published: true,
      no_discount: false,
    });
    setCategoryError('');
  };

  const validateCategory = (category: string, type: 'grain' | 'drip' | 'coldbrew'): boolean => {
    setCategoryError('');
    if (type === 'grain' && category.toLowerCase() === 'дрипы') {
      setCategoryError('Такое название нельзя выбрать');
      return false;
    }
    return true;
  };

  const calculateRubPrice = (usdPrice: string): number => {
    const usd = parseFloat(usdPrice);
    if (isNaN(usd)) return 0;
    return Math.round(usd * exchangeRate);
  };

  const handleTypeChange = (value: 'grain' | 'drip' | 'coldbrew') => {
    setFormData(prev => ({
      ...prev,
      type: value,
      category: value === 'drip' ? 'Дрипы' : value === 'coldbrew' ? 'Колд брю' : '',
    }));
    setCategoryError('');
  };

  const handleCategoryChange = (value: string) => {
    setFormData(prev => ({ ...prev, category: value }));
    validateCategory(value, formData.type);
  };

  const handleAdd = async () => {
    const isColdBrew = formData.type === 'coldbrew';
    if (isColdBrew) {
      if (!formData.name || !formData.price_usd_kg) {
        toast.error('Заполните название и цену');
        return;
      }
    } else {
      if (!formData.name || !formData.country || !formData.process || !formData.category || !formData.price_usd_kg || !formData.price_usd_200) {
        toast.error('Заполните все обязательные поля');
        return;
      }
    }

    const category = formData.type === 'drip' ? 'Дрипы' : formData.type === 'coldbrew' ? 'Колд брю' : formData.category;
    if (!isColdBrew && !validateCategory(category, formData.type)) return;

    try {
      setIsSaving(true);
      const priceUsdKg = parseFloat(formData.price_usd_kg);
      const priceUsd200 = isColdBrew ? 0 : parseFloat(formData.price_usd_200);

      if (isNaN(priceUsdKg) || (!isColdBrew && isNaN(priceUsd200))) {
        toast.error('Введите корректные цены');
        return;
      }

      await createCoffeeItem({
        name: formData.name,
        country: formData.country,
        process: formData.process,
        category,
        type: formData.type,
        descriptors: formData.descriptors || undefined,
        qScore: formData.qScore ? Number(formData.qScore) : undefined,
        badge: (formData.badge || null) as any,
        price_usd_kg: priceUsdKg,
        price_usd_200: priceUsd200,
        price_kg: Math.round(priceUsdKg * exchangeRate),
        price_200: isColdBrew ? 0 : Math.round(priceUsd200 * exchangeRate),
        published: formData.published,
        no_discount: formData.no_discount,
      });

      toast.success('Позиция добавлена');
      setIsAddDialogOpen(false);
      resetForm();
      await loadItems();
    } catch (error) {
      console.error('Failed to create coffee item:', error);
      toast.error('Ошибка при добавлении позиции');
    } finally {
      setIsSaving(false);
    }
  };

  const openEditDialog = (item: CoffeeItem) => {
    setEditingItem(item);
    setFormData({
      type: item.type,
      name: item.name,
      country: item.country,
      process: item.process,
      category: item.category,
      descriptors: item.descriptors || '',
      qScore: item.qScore?.toString() || '',
      badge: item.badge || '',
      price_usd_kg: item.price_usd_kg?.toString() || '',
      price_usd_200: item.price_usd_200?.toString() || '',
      published: item.published !== false,
      no_discount: item.no_discount || false,
    });
    setCategoryError('');
    setIsEditDialogOpen(true);
  };

  const handleUpdate = async () => {
    if (!editingItem) return;
    const isColdBrew = formData.type === 'coldbrew';
    if (isColdBrew) {
      if (!formData.name || !formData.price_usd_kg) {
        toast.error('Заполните название и цену');
        return;
      }
    } else {
      if (!formData.name || !formData.country || !formData.process || !formData.category || !formData.price_usd_kg || !formData.price_usd_200) {
        toast.error('Заполните все обязательные поля');
        return;
      }
    }

    const category = formData.type === 'drip' ? 'Дрипы' : formData.type === 'coldbrew' ? 'Колд брю' : formData.category;
    if (!isColdBrew && !validateCategory(category, formData.type)) return;

    try {
      setIsSaving(true);
      const priceUsdKg = parseFloat(formData.price_usd_kg);
      const priceUsd200 = isColdBrew ? 0 : parseFloat(formData.price_usd_200);

      if (isNaN(priceUsdKg) || (!isColdBrew && isNaN(priceUsd200))) {
        toast.error('Введите корректные цены');
        return;
      }

      await updateCoffeeItem(editingItem.id, {
        name: formData.name,
        country: formData.country,
        process: formData.process,
        category,
        type: formData.type,
        descriptors: formData.descriptors || undefined,
        qScore: formData.qScore ? Number(formData.qScore) : undefined,
        badge: (formData.badge || null) as any,
        price_usd_kg: priceUsdKg,
        price_usd_200: priceUsd200,
        price_kg: Math.round(priceUsdKg * exchangeRate),
        price_200: isColdBrew ? 0 : Math.round(priceUsd200 * exchangeRate),
        published: formData.published,
        no_discount: formData.no_discount,
      });

      toast.success('Позиция обновлена');
      setIsEditDialogOpen(false);
      setEditingItem(null);
      resetForm();
      await loadItems();
    } catch (error) {
      console.error('Failed to update coffee item:', error);
      toast.error('Ошибка при обновлении позиции');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteItemId) return;
    try {
      setIsDeleting(true);
      await deleteCoffeeItem(deleteItemId);
      toast.success('Позиция удалена');
      setDeleteItemId(null);
      await loadItems();
    } catch (error) {
      console.error('Failed to delete coffee item:', error);
      toast.error('Ошибка при удалении позиции');
    } finally {
      setIsDeleting(false);
    }
  };

  const moveRow = useCallback((dragIndex: number, hoverIndex: number, category: string) => {
    setItems(prev => {
      const updated = [...prev];
      // Находим все элементы данной категории
      const categoryItems = updated.filter(it => it.category === category);
      const otherItems = updated.filter(it => it.category !== category);

      const dragged = categoryItems[dragIndex];
      categoryItems.splice(dragIndex, 1);
      categoryItems.splice(hoverIndex, 0, dragged);

      return [...otherItems, ...categoryItems];
    });
  }, []);

  const handleDropSave = useCallback(async () => {
    const snapshot = itemsRef.current;
    if (!snapshot.length) return;
    try {
      await reorderCoffeeItems(snapshot);
    } catch (error) {
      console.error('Failed to reorder:', error);
      toast.error(error instanceof Error ? error.message : 'Не удалось сохранить порядок позиций');
    }
  }, []);

  // Группируем по категориям
  const groupedItems = useMemo(() => {
    const map = new Map<string, CoffeeItem[]>();
    for (const item of items) {
      const cat = item.category || 'Без категории';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(item);
    }
    return map;
  }, [items]);

  // Блокируем закрытие диалога при взаимодействии вне (iOS клавиатура)
  const preventClose = (e: Event) => e.preventDefault();

  const tableContent = (
    <>
      {groupedItems.size === 0 && !isLoading && (
        <div className="text-center py-12 text-muted-foreground">
          Нет позиций. Добавьте первую позицию.
        </div>
      )}
      {Array.from(groupedItems.entries()).map(([category, categoryItems]) => {
        const isColdBrewSection = categoryItems[0]?.type === 'coldbrew';
        return (
        <div key={category} className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">{category}</h3>
            <span className="text-xs text-muted-foreground">({categoryItems.length})</span>
          </div>
          <div className="overflow-x-auto rounded-lg border border-border">
            {isMobile ? (
              <table className="w-full text-sm min-w-[500px]">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Название</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Страна / Обр.</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Категория</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Статус</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">
                      {isColdBrewSection ? 'Цена / 5 л ₽' : 'Цена ₽'}
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {categoryItems.map(item => (
                    <StaticRow
                      key={item.id}
                      item={item}
                      openEditDialog={openEditDialog}
                      setDeleteItemId={setDeleteItemId}
                    />
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-sm min-w-[900px]">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="px-3 py-3 w-8"></th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Название</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Страна</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Обработка</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Категория</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Статус</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {isColdBrewSection ? '$ / 5 л' : '$ / кг'}
                    </th>
                    {!isColdBrewSection && <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide">$ / 200г</th>}
                    <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {isColdBrewSection ? '₽ / 5 л' : '₽ / кг'}
                    </th>
                    {!isColdBrewSection && <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide">₽ / 200г</th>}
                    <th className="px-6 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wide">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {categoryItems.map((item, index) => (
                    <DraggableRow
                      key={item.id}
                      item={item}
                      index={index}
                      category={category}
                      moveRow={moveRow}
                      onDrop={handleDropSave}
                      openEditDialog={openEditDialog}
                      setDeleteItemId={setDeleteItemId}
                      isColdBrew={isColdBrewSection}
                    />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
        );
      })}
    </>
  );

  return (
    <DndProvider backend={HTML5Backend}>
      <div>
        <FadeIn>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <h2 className="text-foreground">Управление прайсом</h2>

            {/* Курс доллара */}
            <div className="flex items-center gap-3 bg-muted/30 px-4 py-2 rounded-lg border border-border">
              <DollarSign className="w-5 h-5 text-muted-foreground" />
              <div className="flex items-center gap-2">
                {isEditingRate ? (
                  <>
                    <Input
                      type="number"
                      value={tempRate}
                      onChange={(e) => setTempRate(e.target.value)}
                      className="w-20 h-8"
                      placeholder="95"
                      step="0.1"
                    />
                    <span className="text-sm text-muted-foreground">₽</span>
                    <Button
                      size="sm"
                      onClick={handleSaveExchangeRate}
                      disabled={isSavingRate}
                      className="h-8"
                    >
                      {isSavingRate ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Save className="w-3 h-3" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setIsEditingRate(false);
                        setTempRate(exchangeRate.toString());
                      }}
                      className="h-8"
                    >
                      ✕
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="text-sm">Курс: <strong>{exchangeRate}</strong> ₽</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setIsEditingRate(true)}
                      className="h-8"
                    >
                      <Pencil className="w-3 h-3" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end mb-4">
            <Button
              onClick={() => {
                resetForm();
                setIsAddDialogOpen(true);
              }}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="w-4 h-4" />
              Добавить позицию
            </Button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            tableContent
          )}
        </FadeIn>

        {/* Add Dialog */}
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogContent
            className="max-h-[85vh] flex flex-col"
            onInteractOutside={preventClose}
            onPointerDownOutside={preventClose}
          >
            <DialogHeader>
              <DialogTitle className="text-foreground">Добавить позицию</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 overflow-y-auto pr-2 flex-1">
              <DialogDescription className="text-sm text-muted-foreground">
                Заполните форму, чтобы добавить новую позицию в прайс. Цены указываются в долларах.
              </DialogDescription>

              {/* Тип */}
              <div className="space-y-2">
                <Label htmlFor="add-type" className="text-foreground">Тип</Label>
                <Select value={formData.type} onValueChange={(v) => handleTypeChange(v as 'grain' | 'drip' | 'coldbrew')}>
                  <SelectTrigger id="add-type">
                    <SelectValue placeholder="Выберите тип" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="grain">Зерно</SelectItem>
                    <SelectItem value="drip">Дрипы</SelectItem>
                    <SelectItem value="coldbrew">Колд брю</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Название */}
              <div className="space-y-2">
                <Label htmlFor="add-name" className="text-foreground">Название *</Label>
                <Input
                  id="add-name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder={formData.type === 'coldbrew' ? 'Например: Колд брю «Эфиопия»' : 'Например: Колумбия Уила'}
                />
              </div>

              {/* Категория */}
              <div className="space-y-2">
                <Label htmlFor="add-category" className="text-foreground">Категория *</Label>
                <Input
                  id="add-category"
                  value={formData.category}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  placeholder={formData.type === 'drip' ? 'Дрипы' : formData.type === 'coldbrew' ? 'Колд брю' : 'Например: Эспрессо'}
                  disabled={formData.type === 'drip' || formData.type === 'coldbrew'}
                />
                {categoryError && (
                  <p className="text-xs text-destructive">{categoryError}</p>
                )}
              </div>

              {/* Страна */}
              <div className="space-y-2">
                <Label htmlFor="add-country" className="text-foreground">Страна *</Label>
                <Input
                  id="add-country"
                  value={formData.country}
                  onChange={(e) => setFormData(prev => ({ ...prev, country: e.target.value }))}
                  placeholder="Например: Колумбия"
                />
              </div>

              {/* Обработка */}
              <div className="space-y-2">
                <Label htmlFor="add-process" className="text-foreground">Обработка *</Label>
                <Input
                  id="add-process"
                  value={formData.process}
                  onChange={(e) => setFormData(prev => ({ ...prev, process: e.target.value }))}
                  placeholder="Мытый, Натуральный, Хани"
                />
              </div>

              {/* Дескрипторы */}
              <div className="space-y-2">
                <Label htmlFor="add-descriptors" className="text-foreground">Дескрипторы</Label>
                <Input
                  id="add-descriptors"
                  value={formData.descriptors}
                  onChange={(e) => setFormData(prev => ({ ...prev, descriptors: e.target.value }))}
                  placeholder="Например: фрукты, ягоды, орехи"
                />
              </div>

              {/* Q-Score */}
              <div className="space-y-2">
                <Label htmlFor="add-qscore" className="text-foreground">Q-Score</Label>
                <Input
                  id="add-qscore"
                  type="number"
                  min="0"
                  max="100"
                  value={formData.qScore}
                  onChange={(e) => setFormData(prev => ({ ...prev, qScore: e.target.value }))}
                  placeholder="Например: 87"
                />
              </div>

              {/* Бейдж */}
              <div className="space-y-2">
                <Label htmlFor="add-badge" className="text-foreground">Бейдж</Label>
                <Select value={formData.badge || 'none'} onValueChange={(v) => setFormData(prev => ({ ...prev, badge: v === 'none' ? '' : v as any }))}>
                  <SelectTrigger id="add-badge">
                    <SelectValue placeholder="Без бейджа" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Без бейджа</SelectItem>
                    <SelectItem value="new">Новинка</SelectItem>
                    <SelectItem value="hit">Хит</SelectItem>
                    <SelectItem value="rare">Редкий</SelectItem>
                    <SelectItem value="favorite">Любимый</SelectItem>
                    <SelectItem value="soldout">Распродан</SelectItem>
                    <SelectItem value="comingsoon">Скоро</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Цена за 5л / кг / упак */}
              <div className="space-y-2">
                <Label htmlFor="add-price-kg" className="text-foreground">
                  {formData.type === 'coldbrew' ? 'Цена за 5 л ($) *' : 'Цена за кг ($) *'}
                </Label>
                <Input
                  id="add-price-kg"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price_usd_kg}
                  onChange={(e) => setFormData(prev => ({ ...prev, price_usd_kg: e.target.value }))}
                  placeholder={formData.type === 'coldbrew' ? '25.00' : '19.50'}
                />
                {formData.price_usd_kg && (
                  <p className="text-xs text-muted-foreground">≈ {calculateRubPrice(formData.price_usd_kg).toLocaleString('ru-RU')} ₽</p>
                )}
              </div>

              {/* Цена за 200г — только для grain/drip */}
              {formData.type !== 'coldbrew' && (
                <div className="space-y-2">
                  <Label htmlFor="add-price-200" className="text-foreground">
                    {formData.type === 'drip' ? 'Цена за штуку ($) *' : 'Цена за 200г ($) *'}
                  </Label>
                  <Input
                    id="add-price-200"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.price_usd_200}
                    onChange={(e) => setFormData(prev => ({ ...prev, price_usd_200: e.target.value }))}
                    placeholder="5.50"
                  />
                  {formData.price_usd_200 && (
                    <p className="text-xs text-muted-foreground">≈ {calculateRubPrice(formData.price_usd_200).toLocaleString('ru-RU')} ₽</p>
                  )}
                </div>
              )}

              {/* Опубликован */}
              <div className="flex items-center justify-between space-x-2 py-2 px-3 bg-muted/30 rounded-lg border border-border">
                <Label htmlFor="add-published" className="text-foreground cursor-pointer flex-1">Опубликован</Label>
                <Switch
                  id="add-published"
                  checked={formData.published}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, published: checked }))}
                />
              </div>

              {/* Не учитывать скидку */}
              <div className="flex items-center justify-between space-x-2 py-2 px-3 bg-muted/30 rounded-lg border border-border">
                <Label htmlFor="add-no-discount" className="text-foreground cursor-pointer flex-1">Не учитывать скидку</Label>
                <Switch
                  id="add-no-discount"
                  checked={formData.no_discount}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, no_discount: checked }))}
                />
              </div>

              <Button
                onClick={handleAdd}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={!!categoryError || isSaving}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Сохранение...
                  </>
                ) : (
                  'Сохранить'
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent
            className="max-h-[85vh] flex flex-col"
            onInteractOutside={preventClose}
            onPointerDownOutside={preventClose}
          >
            <DialogHeader>
              <DialogTitle className="text-foreground">Редактировать позицию</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 overflow-y-auto pr-2 flex-1">
              <DialogDescription className="text-sm text-muted-foreground">
                Заполните форму, чтобы изменить существующую позицию в прайсе. Цены указываются в долларах.
              </DialogDescription>

              {/* Тип */}
              <div className="space-y-2">
                <Label htmlFor="edit-type" className="text-foreground">Тип</Label>
                <Select value={formData.type} onValueChange={(v) => handleTypeChange(v as 'grain' | 'drip' | 'coldbrew')}>
                  <SelectTrigger id="edit-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="grain">Зерно</SelectItem>
                    <SelectItem value="drip">Дрипы</SelectItem>
                    <SelectItem value="coldbrew">Колд брю</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Название */}
              <div className="space-y-2">
                <Label htmlFor="edit-name" className="text-foreground">Название *</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>

              {/* Категория */}
              <div className="space-y-2">
                <Label htmlFor="edit-category" className="text-foreground">Категория *</Label>
                <Input
                  id="edit-category"
                  value={formData.category}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  placeholder={formData.type === 'drip' ? 'Дрипы' : formData.type === 'coldbrew' ? 'Колд брю' : 'Например: Эспрессо'}
                  disabled={formData.type === 'drip' || formData.type === 'coldbrew'}
                />
                {categoryError && (
                  <p className="text-xs text-destructive">{categoryError}</p>
                )}
              </div>

              {/* Страна */}
              <div className="space-y-2">
                <Label htmlFor="edit-country" className="text-foreground">Страна *</Label>
                <Input
                  id="edit-country"
                  value={formData.country}
                  onChange={(e) => setFormData(prev => ({ ...prev, country: e.target.value }))}
                />
              </div>

              {/* Обработка */}
              <div className="space-y-2">
                <Label htmlFor="edit-process" className="text-foreground">Обработка *</Label>
                <Input
                  id="edit-process"
                  value={formData.process}
                  onChange={(e) => setFormData(prev => ({ ...prev, process: e.target.value }))}
                />
              </div>

              {/* Дескрипторы */}
              <div className="space-y-2">
                <Label htmlFor="edit-descriptors" className="text-foreground">Дескрипторы</Label>
                <Input
                  id="edit-descriptors"
                  value={formData.descriptors}
                  onChange={(e) => setFormData(prev => ({ ...prev, descriptors: e.target.value }))}
                  placeholder="Например: фрукты, ягоды, орехи"
                />
              </div>

              {/* Q-Score */}
              <div className="space-y-2">
                <Label htmlFor="edit-qscore" className="text-foreground">Q-Score</Label>
                <Input
                  id="edit-qscore"
                  type="number"
                  min="0"
                  max="100"
                  value={formData.qScore}
                  onChange={(e) => setFormData(prev => ({ ...prev, qScore: e.target.value }))}
                  placeholder="Например: 87"
                />
              </div>

              {/* Бейдж */}
              <div className="space-y-2">
                <Label htmlFor="edit-badge" className="text-foreground">Бейдж</Label>
                <Select value={formData.badge || 'none'} onValueChange={(v) => setFormData(prev => ({ ...prev, badge: v === 'none' ? '' : v as any }))}>
                  <SelectTrigger id="edit-badge">
                    <SelectValue placeholder="Без бейджа" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Без бейджа</SelectItem>
                    <SelectItem value="new">Новинка</SelectItem>
                    <SelectItem value="hit">Хит</SelectItem>
                    <SelectItem value="rare">Редкий</SelectItem>
                    <SelectItem value="favorite">Любимый</SelectItem>
                    <SelectItem value="soldout">Распродан</SelectItem>
                    <SelectItem value="comingsoon">Скоро</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Цена за 5л / кг / упак */}
              <div className="space-y-2">
                <Label htmlFor="edit-price-kg" className="text-foreground">
                  {formData.type === 'coldbrew' ? 'Цена за 5 л ($) *' : 'Цена за кг ($) *'}
                </Label>
                <Input
                  id="edit-price-kg"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price_usd_kg}
                  onChange={(e) => setFormData(prev => ({ ...prev, price_usd_kg: e.target.value }))}
                />
                {formData.price_usd_kg && (
                  <p className="text-xs text-muted-foreground">≈ {calculateRubPrice(formData.price_usd_kg).toLocaleString('ru-RU')} ₽</p>
                )}
              </div>

              {/* Цена за 200г — только для grain/drip */}
              {formData.type !== 'coldbrew' && (
                <div className="space-y-2">
                  <Label htmlFor="edit-price-200" className="text-foreground">
                    {formData.type === 'drip' ? 'Цена за штуку ($) *' : 'Цена за 200г ($) *'}
                  </Label>
                  <Input
                    id="edit-price-200"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.price_usd_200}
                    onChange={(e) => setFormData(prev => ({ ...prev, price_usd_200: e.target.value }))}
                  />
                  {formData.price_usd_200 && (
                    <p className="text-xs text-muted-foreground">≈ {calculateRubPrice(formData.price_usd_200).toLocaleString('ru-RU')} ₽</p>
                  )}
                </div>
              )}

              {/* Опубликован */}
              <div className="flex items-center justify-between space-x-2 py-2 px-3 bg-muted/30 rounded-lg border border-border">
                <Label htmlFor="edit-published" className="text-foreground cursor-pointer flex-1">Опубликован</Label>
                <Switch
                  id="edit-published"
                  checked={formData.published}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, published: checked }))}
                />
              </div>

              {/* Не учитывать скидку */}
              <div className="flex items-center justify-between space-x-2 py-2 px-3 bg-muted/30 rounded-lg border border-border">
                <Label htmlFor="edit-no-discount" className="text-foreground cursor-pointer flex-1">Не учитывать скидку</Label>
                <Switch
                  id="edit-no-discount"
                  checked={formData.no_discount}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, no_discount: checked }))}
                />
              </div>

              <Button
                onClick={handleUpdate}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={!!categoryError || isSaving}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Сохранение...
                  </>
                ) : (
                  'Сохранить'
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={!!deleteItemId} onOpenChange={(open) => !open && setDeleteItemId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Удалить позицию?</AlertDialogTitle>
              <AlertDialogDescription>
                Это действие нельзя отменить. Позиция будет удалена из прайса навсегда.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Отмена</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-white hover:bg-destructive/90"
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Удаление...
                  </>
                ) : (
                  'Удалить'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DndProvider>
  );
}