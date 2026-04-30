import { useState, useEffect, useRef, useCallback } from 'react';
import { useDrag, useDrop, DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Switch } from './ui/switch';
import { GripVertical, Pencil, Trash2, Plus, Database, Loader2, Upload, X, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import {
  fetchRetailProducts,
  createRetailProduct,
  updateRetailProduct,
  deleteRetailProduct,
  uploadRetailImage,
  initRetailTestData,
  updateRetailProductsOrder,
  fetchCategoryOrder,
  saveCategoryOrder,
  DEFAULT_CATEGORY_ORDER,
  type RetailProduct
} from '../lib/api';

interface DraggableRowProps {
  product: RetailProduct;
  index: number;
  category: string;
  moveProduct: (dragIndex: number, hoverIndex: number, category: string) => void;
  onSaveOrder: (category: string) => void;
  onEdit: (product: RetailProduct) => void;
  onDelete: (id: string) => void;
  onTogglePublished: (id: string, currentState: boolean) => void;
}

// ── Drag-and-drop для фото фермы ──────────────────────────────────────────────
interface DraggableFarmPhotoProps {
  url: string;
  index: number;
  total: number;
  onMove: (from: number, to: number) => void;
  onDelete: (index: number) => void;
}

const DraggableFarmPhoto = ({ url, index, total, onMove, onDelete }: DraggableFarmPhotoProps) => {
  const [{ isDragging }, drag, dragPreview] = useDrag({
    type: 'FARM_PHOTO',
    item: { index },
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  });

  const [{ isOver }, drop] = useDrop({
    accept: 'FARM_PHOTO',
    collect: (monitor) => ({ isOver: monitor.isOver() }),
    hover: (item: { index: number }) => {
      if (item.index === index) return;
      onMove(item.index, index);
      item.index = index;
    },
  });

  return (
    <div
      ref={(node) => dragPreview(drop(node))}
      className={`relative rounded-xl border-2 transition-all duration-150 select-none ${
        isOver ? 'border-[#FF90A1] scale-105' : 'border-transparent'
      } ${isDragging ? 'opacity-40' : 'opacity-100'}`}
      style={{ width: 'clamp(88px, 28vw, 120px)', height: 'clamp(88px, 28vw, 120px)' }}
    >
      <img
        src={url}
        alt={`Ферма ${index + 1}`}
        className="w-full h-full object-cover rounded-[10px]"
        draggable={false}
      />

      {/* Grip handle */}
      <div
        ref={drag}
        className="absolute top-1.5 left-1.5 cursor-grab active:cursor-grabbing w-8 h-8 rounded-lg bg-black/55 backdrop-blur-sm flex items-center justify-center"
      >
        <GripVertical className="w-4 h-4 text-white" />
      </div>

      {/* Delete button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(index);
        }}
        className="absolute top-1.5 right-1.5 w-8 h-8 rounded-lg bg-black/55 backdrop-blur-sm flex items-center justify-center hover:bg-red-500 active:bg-red-600 transition-colors"
      >
        <X className="w-4 h-4 text-white" />
      </button>

      {/* Order number */}
      <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 bg-black/55 backdrop-blur-sm text-white text-[10px] px-1.5 py-0.5 rounded-md leading-none whitespace-nowrap">
        {index + 1}/{total}
      </div>
    </div>
  );
};
// ─────────────────────────────────────────────────────────────────────────────

const DraggableRow = ({ product, index, category, moveProduct, onSaveOrder, onEdit, onDelete, onTogglePublished }: DraggableRowProps) => {
  const ref = useRef<HTMLTableRowElement>(null);

  const [{ handlerId }, drop] = useDrop({
    accept: 'PRODUCT_ROW',
    collect(monitor) {
      return { handlerId: monitor.getHandlerId() };
    },
    hover(dragItem: any, monitor) {
      if (!ref.current) return;
      if (dragItem.category !== category) return;

      const dragIndex = dragItem.index;
      const hoverIndex = index;
      if (dragIndex === hoverIndex) return;

      // Проверяем midpoint чтобы избежать мерцания
      const hoverBoundingRect = ref.current.getBoundingClientRect();
      const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
      const clientOffset = monitor.getClientOffset();
      if (!clientOffset) return;
      const hoverClientY = clientOffset.y - hoverBoundingRect.top;

      if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) return;
      if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) return;

      moveProduct(dragIndex, hoverIndex, category);
      dragItem.index = hoverIndex;
    },
    drop(dragItem: any) {
      // Сохраняем на сервер только при отпускании (не на каждый hover!)
      onSaveOrder(dragItem.category);
    },
  });

  const [{ isDragging }, drag] = useDrag({
    type: 'PRODUCT_ROW',
    item: () => ({ id: product.id, index, category }),
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  });

  drag(drop(ref));

  return (
    <tr
      ref={ref}
      data-handler-id={handlerId}
      className={`border-t border-border transition-opacity ${isDragging ? 'opacity-40' : 'opacity-100'}`}
    >
      <td className="p-4">
        <div className="cursor-move inline-block hover:text-foreground transition-colors">
          <GripVertical className="w-5 h-5 text-muted-foreground" />
        </div>
      </td>
      <td className="p-4">
        <img
          src={product.imageUrl}
          alt={product.name}
          className="w-16 h-16 object-cover rounded border border-border"
          draggable={false}
        />
      </td>
      <td className="p-4 text-foreground">{product.name}</td>
      <td className="p-4">
        <span className="inline-block px-2 py-1 text-xs rounded-full bg-muted text-foreground">
          {product.category || 'Без категории'}
        </span>
      </td>
      <td className="p-4 text-muted-foreground text-sm max-w-md truncate">
        {product.description}
      </td>
      <td className="p-4 text-foreground">
        {product.type === 'bean' ? (
          <div className="flex flex-col gap-1 text-sm">
            {product.price200 && <span>200г: {product.price200}₽</span>}
            {product.price1000 && <span>1кг: {product.price1000}₽</span>}
          </div>
        ) : product.type === 'drip' ? (
          <span>{product.pricePack}₽ / уп.</span>
        ) : product.type === 'accessory' ? (
          <span>{product.price}₽ / шт.</span>
        ) : (
          <span>{product.price}₽</span>
        )}
      </td>
      <td className="p-4">
        <div className="flex items-center justify-end gap-2">
          <div className="flex flex-col items-end gap-1 mr-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {product.published !== false ? 'Опубликован' : 'Снят с публикации'}
              </span>
              <Switch
                checked={product.published !== false}
                onCheckedChange={() => onTogglePublished(product.id, product.published !== false)}
              />
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onEdit(product); }}>
            <Pencil className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onDelete(product.id); }}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </td>
    </tr>
  );
};

export function RetailProductsManagement() {
  const [products, setProducts] = useState<RetailProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [categoryOrder, setCategoryOrder] = useState<string[]>(DEFAULT_CATEGORY_ORDER);
  // Ref для актуального стейта — нужен в drop-колбэке чтобы не было stale closure
  const productsRef = useRef<RetailProduct[]>([]);
  const categoryOrderRef = useRef<string[]>(DEFAULT_CATEGORY_ORDER);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    imageUrl: '',
    category: '',
    type: 'bean', // Default to 'bean'
    weight: '',
    roast: '',
    grind: '',
    longDescription: '',
    cardText: '',
    packageLength: '',
    packageHeight: '',
    packageWidth: '',
    packageWeight: '',
    acidity: '',
    bitterness: '',
    sweetness: '',
    price200: '',
    price1000: '',
    pricePack: '',
    recommended: false
  });
  const [isUploading, setIsUploading] = useState(false);
  const [farmPhotos, setFarmPhotos] = useState<string[]>([]);
  const [isUploadingFarm, setIsUploadingFarm] = useState(false);

  useEffect(() => {
    loadProducts();
    fetchCategoryOrder().then(setCategoryOrder);
  }, []);

  const loadProducts = async () => {
    try {
      setIsLoading(true);
      const items = await fetchRetailProducts();

      // Нормализуем старое название категории
      const normalized = items.map(p =>
        p.category === 'Дрип кофе' ? { ...p, category: 'Дрип' } : p
      );

      // Сортируем по displayOrder внутри каждой категории
      const sorted = normalized.sort((a, b) => {
        const catA = a.category || 'Прочее';
        const catB = b.category || 'Прочее';

        const catOrderMap: Record<string, number> = {};
        categoryOrderRef.current.forEach((c, i) => { catOrderMap[c] = i + 1; });
        catOrderMap['Прочее'] = 999;

        const orderA = catOrderMap[catA] ?? 998;
        const orderB = catOrderMap[catB] ?? 998;

        if (orderA !== orderB) return orderA - orderB;
        return (a.displayOrder || 0) - (b.displayOrder || 0);
      });

      setProducts(sorted);
      productsRef.current = sorted;
    } catch (error) {
      console.error('Failed to load retail products:', error);
      toast.error('Не удалось загрузить товары');
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.match(/^image\/(jpeg|png)$/)) {
      toast.error('Допустимы только JPEG и PNG файлы');
      return;
    }

    // Validate file size (10 MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Максимальный размер файла 10 МБ');
      return;
    }

    // Validate image dimensions
    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = async () => {
      URL.revokeObjectURL(img.src);
      
      if (img.width !== 1000 || img.height !== 1000) {
        toast.error('Изображение должно быть 1000x1000 пикселей');
        return;
      }

      try {
        setIsUploading(true);
        const url = await uploadRetailImage(file);
        setFormData(prev => ({ ...prev, imageUrl: url }));
        toast.success('Изображение загружено');
      } catch (error) {
        console.error('Failed to upload image:', error);
        toast.error('Не удалось загрузить изображение');
      } finally {
        setIsUploading(false);
      }
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.description || !formData.imageUrl) {
      toast.error('Заполните обязательные поля (Название, Описание, Фото)');
      return;
    }

    // Validation based on type
    let price = 0;
    if (formData.type === 'equipment' || formData.type === 'accessory') {
      price = parseFloat(formData.price);
      if (isNaN(price) || price <= 0) {
        toast.error(formData.type === 'accessory' ? 'Укажите цену за штуку' : 'Укажите цену для оборудования');
        return;
      }
    } else if (formData.type === 'drip') {
      const pricePack = parseFloat(formData.pricePack);
      if (isNaN(pricePack) || pricePack <= 0) {
        toast.error('Укажите цену за упаковку дрипов');
        return;
      }
      price = pricePack; // Base price for sorting/display
    } else {
      // Bean
      const price200 = parseFloat(formData.price200);
      const price1000 = parseFloat(formData.price1000);
      
      if ((isNaN(price200) || price200 <= 0) && (isNaN(price1000) || price1000 <= 0)) {
        toast.error('Укажите хотя бы одну цену (200гр или 1кг)');
        return;
      }
      
      // Set base price to the lowest available price
      if (!isNaN(price200) && price200 > 0) price = price200;
      else if (!isNaN(price1000) && price1000 > 0) price = price1000;
    }

    try {
      const productData = {
        name: formData.name,
        description: formData.description,
        price,
        imageUrl: formData.imageUrl,
        category: formData.category,
        type: formData.type as 'bean' | 'drip' | 'equipment' | 'accessory',
        weight: formData.type === 'bean' ? formData.weight : '',
        roast: formData.type === 'bean' ? formData.roast : '',
        grind: formData.type === 'bean' ? formData.grind : '',
        longDescription: formData.longDescription,
        cardText: formData.cardText,
        packageLength: formData.packageLength ? parseFloat(formData.packageLength) : undefined,
        packageHeight: formData.packageHeight ? parseFloat(formData.packageHeight) : undefined,
        packageWidth: formData.packageWidth ? parseFloat(formData.packageWidth) : undefined,
        packageWeight: formData.packageWeight ? parseFloat(formData.packageWeight) : undefined,
        acidity: (formData.type !== 'equipment' && formData.type !== 'accessory') && formData.acidity ? parseInt(formData.acidity) : undefined,
        bitterness: (formData.type !== 'equipment' && formData.type !== 'accessory') && formData.bitterness ? parseInt(formData.bitterness) : undefined,
        sweetness: (formData.type !== 'equipment' && formData.type !== 'accessory') && formData.sweetness ? parseInt(formData.sweetness) : undefined,
        price200: formData.type === 'bean' && formData.price200 ? parseFloat(formData.price200) : undefined,
        price1000: formData.type === 'bean' && formData.price1000 ? parseFloat(formData.price1000) : undefined,
        pricePack: formData.type === 'drip' && formData.pricePack ? parseFloat(formData.pricePack) : undefined,
        farmPhotos: farmPhotos, // всегда передаём массив (пустой [] явно сбросит фото на сервере)
        recommended: formData.recommended
      };

      if (editingId) {
        await updateRetailProduct(editingId, productData);
        toast.success('Товар обновлен');
      } else {
        await createRetailProduct(productData);
        toast.success('Товар создан');
      }

      setFormData({ 
        name: '', 
        description: '', 
        price: '', 
        imageUrl: '', 
        category: '',
        type: 'bean',
        weight: '', 
        roast: '', 
        grind: '', 
        longDescription: '',
        cardText: '',
        packageLength: '',
        packageHeight: '',
        packageWidth: '',
        packageWeight: '',
        acidity: '',
        bitterness: '',
        sweetness: '',
        price200: '',
        price1000: '',
        pricePack: '',
        recommended: false
      });
      setFarmPhotos([]);
      setEditingId(null);
      setIsCreating(false);
      loadProducts();
    } catch (error) {
      console.error('Failed to save product:', error);
      toast.error('Не удалось сохранить товар');
    }
  };

  const handleEdit = (product: RetailProduct) => {
    setEditingId(product.id);
    
    // Determine type if not set
    let type = product.type;
    if (!type) {
      if (product.category === 'Дрип') type = 'drip';
      else if (product.category === 'Оборудование') type = 'equipment';
      else if (product.category === 'Аксессуары') type = 'accessory';
      else type = 'bean';
    }

    setFormData({
      name: product.name,
      description: product.description,
      price: product.price.toString(),
      imageUrl: product.imageUrl,
      category: product.category || '',
      type: type || 'bean',
      weight: product.weight || '',
      roast: product.roast || '',
      grind: product.grind || '',
      longDescription: product.longDescription || '',
      cardText: product.cardText || '',
      packageLength: product.packageLength?.toString() || '',
      packageHeight: product.packageHeight?.toString() || '',
      packageWidth: product.packageWidth?.toString() || '',
      packageWeight: product.packageWeight?.toString() || '',
      acidity: product.acidity?.toString() || '',
      bitterness: product.bitterness?.toString() || '',
      sweetness: product.sweetness?.toString() || '',
      price200: product.price200?.toString() || '',
      price1000: product.price1000?.toString() || '',
      pricePack: product.pricePack?.toString() || '',
      recommended: product.recommended || false
    });
    setFarmPhotos(product.farmPhotos || []);
    setIsCreating(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить товар?')) return;

    try {
      await deleteRetailProduct(id);
      toast.success('Товар удален');
      loadProducts();
    } catch (error) {
      console.error('Failed to delete product:', error);
      toast.error('Не удалось удалить товар');
    }
  };

  const handleTogglePublished = async (id: string, currentState: boolean) => {
    try {
      await updateRetailProduct(id, { published: !currentState });
      setProducts(prev => {
        const updated = prev.map(p => p.id === id ? { ...p, published: !currentState } : p);
        productsRef.current = updated;
        return updated;
      });
    } catch (error) {
      console.error('Failed to toggle published:', error);
      toast.error('Не удалось изменить статус');
    }
  };

  const handleCancel = () => {
    setFormData({ 
      name: '', 
      description: '', 
      price: '', 
      imageUrl: '', 
      category: '',
      type: 'bean',
      weight: '', 
      roast: '', 
      grind: '', 
      longDescription: '',
      cardText: '',
      packageLength: '',
      packageHeight: '',
      packageWidth: '',
      packageWeight: '',
      acidity: '',
      bitterness: '',
      sweetness: '',
      price200: '',
      price1000: '',
      pricePack: '',
      recommended: false
    });
    setFarmPhotos([]);
    setEditingId(null);
    setIsCreating(false);
  };

  const handleInitTestData = async () => {
    if (!confirm('Добавить 9 тестовых товаров?')) return;

    try {
      const result = await initRetailTestData();
      toast.success(`Добавлено ${result.count} тестовых товаров`);
      loadProducts();
    } catch (error) {
      console.error('Failed to init test data:', error);
      toast.error('Не удалось добавить тестовые товары');
    }
  };

  // Синхронная перестановка в локальном стейте — НЕ делает запросов к серверу
  const moveProduct = useCallback((dragIndex: number, hoverIndex: number, category: string) => {
    setProducts(prev => {
      const catProducts = prev.filter(p => (p.category || 'Прочее') === category);
      const otherProducts = prev.filter(p => (p.category || 'Прочее') !== category);

      const updated = [...catProducts];
      const [dragItem] = updated.splice(dragIndex, 1);
      updated.splice(hoverIndex, 0, dragItem);

      const withOrder = updated.map((p, i) => ({ ...p, displayOrder: i }));

      const all = [...otherProducts, ...withOrder];

      // Сортируем по порядку категорий
      const catOrderMap: Record<string, number> = {};
      categoryOrderRef.current.forEach((c, i) => { catOrderMap[c] = i + 1; });
      catOrderMap['Прочее'] = 999;

      all.sort((a, b) => {
        const catA = a.category || 'Прочее';
        const catB = b.category || 'Прочее';
        const orderA = catOrderMap[catA] ?? 998;
        const orderB = catOrderMap[catB] ?? 998;
        if (orderA !== orderB) return orderA - orderB;
        return (a.displayOrder || 0) - (b.displayOrder || 0);
      });

      productsRef.current = all;
      return all;
    });
  }, []);

  // Сохраняем на сервер только при drop (один раз)
  const saveProductOrder = useCallback(async (category: string) => {
    const catProducts = productsRef.current.filter(p => (p.category || 'Прочее') === category);
    const updates = catProducts.map((p, i) => ({ id: p.id, displayOrder: i }));
    try {
      await updateRetailProductsOrder(updates);
    } catch (error) {
      console.error('Failed to update products order:', error);
      toast.error('Не удалось обновить порядок товаров');
      loadProducts();
    }
  }, []);

  const moveCategoryUp = async (index: number) => {
    if (index === 0) return;
    const newOrder = [...categoryOrder];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    setCategoryOrder(newOrder);
    try {
      await saveCategoryOrder(newOrder);
    } catch {
      toast.error('Не удалось сохранить порядок категорий');
    }
  };

  const moveCategoryDown = async (index: number) => {
    if (index === orderedCategories.length - 1) return;
    const newOrder = [...categoryOrder];
    const catIndex = newOrder.indexOf(orderedCategories[index]);
    const nextCatIndex = newOrder.indexOf(orderedCategories[index + 1]);
    [newOrder[catIndex], newOrder[nextCatIndex]] = [newOrder[nextCatIndex], newOrder[catIndex]];
    setCategoryOrder(newOrder);
    try {
      await saveCategoryOrder(newOrder);
    } catch {
      toast.error('Не удалось сохранить порядок категорий');
    }
  };

  // Обновляем ref при изменении categoryOrder
  useEffect(() => {
    categoryOrderRef.current = categoryOrder;
  }, [categoryOrder]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Группируем товары по категориям
  const groupedProducts = products.reduce((acc, product) => {
    const category = product.category || 'Прочее';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(product);
    return acc;
  }, {} as Record<string, RetailProduct[]>);

  const orderedCategories = categoryOrder.filter(cat => groupedProducts[cat]);

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-foreground">Розничные товары</h2>
          {!isCreating && (
            <div className="flex gap-2">
              {products.length === 0 && (
                <Button onClick={handleInitTestData} size="sm" variant="outline">
                  <Database className="w-4 h-4 mr-2" />
                  Добавить тестовые товары
                </Button>
              )}
              <Button onClick={() => setIsCreating(true)} size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Добавить товар
              </Button>
            </div>
          )}
        </div>

      {/* Create/Edit Modal */}
      {isCreating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-border p-6 flex items-center justify-between">
              <h3 className="text-foreground text-xl">
                {editingId ? 'Редактировать товар' : 'Новый товар'}
              </h3>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCancel}
                className="h-8 w-8 p-0"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-sm mb-2 text-foreground">Название</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Название товара"
              />
            </div>

            <div>
              <label className="block text-sm mb-2 text-foreground">Описание</label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Описание товара"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-2 text-foreground">Категория</label>
                <select
                  value={formData.category}
                  onChange={(e) => {
                    const newCategory = e.target.value;
                    let newType = formData.type;
                    
                    // Auto-select type based on category
                    if (newCategory === 'Дрип') newType = 'drip';
                    else if (newCategory === 'Оборудование') newType = 'equipment';
                    else if (newCategory === 'Аксессуары') newType = 'accessory';
                    else if (newCategory === 'Фильтр' || newCategory === 'Эспрессо') newType = 'bean';
                    
                    setFormData(prev => ({ 
                      ...prev, 
                      category: newCategory,
                      type: newType,
                      weight: newType === 'bean' ? prev.weight : '',
                      roast: newType === 'bean' ? prev.roast : '',
                      grind: newType === 'bean' ? prev.grind : ''
                    }));
                  }}
                  className="w-full px-3 py-2 border border-input rounded-md bg-muted/50 text-foreground"
                >
                  <option value="">Выберите категорию</option>
                  <option value="Фильтр">Фильтр</option>
                  <option value="Эспрессо">Эспрессо</option>
                  <option value="Дрип">Дрип</option>
                  <option value="Оборудование">Оборудование</option>
                  <option value="Аксессуары">Аксессуары</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm mb-2 text-foreground">Тип товара</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
                  className="w-full px-3 py-2 border border-input rounded-md bg-muted/50 text-foreground"
                >
                  <option value="bean">Зерно</option>
                  <option value="drip">Дрипы</option>
                  <option value="equipment">Оборудование</option>
                  <option value="accessory">Аксессуар</option>
                </select>
              </div>
            </div>

            {/* Price Inputs Based on Type */}
            {formData.type === 'bean' && (
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
                <div>
                  <label className="block text-sm mb-2 text-foreground">Цена за 200гр (₽)</label>
                  <Input
                    type="number"
                    value={formData.price200}
                    onChange={(e) => setFormData(prev => ({ ...prev, price200: e.target.value }))}
                    placeholder="550"
                    min="0"
                    step="1"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-2 text-foreground">Цена за 1кг (₽)</label>
                  <Input
                    type="number"
                    value={formData.price1000}
                    onChange={(e) => setFormData(prev => ({ ...prev, price1000: e.target.value }))}
                    placeholder="1800"
                    min="0"
                    step="1"
                  />
                </div>
              </div>
            )}

            {formData.type === 'drip' && (
              <div className="p-4 bg-muted/30 rounded-lg">
                <label className="block text-sm mb-2 text-foreground">Цена за Упаковку 6 шт. (₽)</label>
                <Input
                  type="number"
                  value={formData.pricePack}
                  onChange={(e) => setFormData(prev => ({ ...prev, pricePack: e.target.value }))}
                  placeholder="550"
                  min="0"
                  step="1"
                />
              </div>
            )}

            {formData.type === 'equipment' || formData.type === 'accessory' && (
              <div className="p-4 bg-muted/30 rounded-lg">
                <label className="block text-sm mb-2 text-foreground">Цена за шт. (₽)</label>
                <Input
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                  placeholder="1500"
                  min="0"
                  step="1"
                />
              </div>
            )}

            {/* Characteristics - only for bean */}
            {formData.type === 'bean' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm mb-2 text-foreground">Вес (варианты через запятую)</label>
                  <Input
                    value={formData.weight}
                    onChange={(e) => setFormData(prev => ({ ...prev, weight: e.target.value }))}
                    placeholder="200гр, 1000гр (Оставьте пустым для авто-генерации из цен)"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Если заданы цены а 200гр и 1кг, этот список сформируется автоматически.
                  </p>
                </div>
                <div>
                  <label className="block text-sm mb-2 text-foreground">
                    Обжарка (варианты через запятую)
                    <span className="block text-xs text-muted-foreground mt-1">Возможные: Фильтр, Эспрессо</span>
                  </label>
                  <Input
                    value={formData.roast}
                    onChange={(e) => setFormData(prev => ({ ...prev, roast: e.target.value }))}
                    placeholder="Фильтр, Эспрессо"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-2 text-foreground">
                    Помол (варианты через запятую)
                    <span className="block text-xs text-muted-foreground mt-1">
                      Возможные: В зернах, Для турки, Для эспрессо...
                    </span>
                  </label>
                  <Input
                    value={formData.grind}
                    onChange={(e) => setFormData(prev => ({ ...prev, grind: e.target.value }))}
                    placeholder="В зернах, Для туки, Для эспрессо"
                  />
                </div>
              </div>
            )}

            {/* Taste Profile - hide for equipment and accessory */}
            {formData.type !== 'equipment' && formData.type !== 'accessory' && (
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm mb-2 text-foreground">Кислотность (1-10)</label>
                  <Input
                    type="number"
                    min="1"
                    max="10"
                    value={formData.acidity}
                    onChange={(e) => setFormData(prev => ({ ...prev, acidity: e.target.value }))}
                    placeholder="5"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-2 text-foreground">Горечь (1-10)</label>
                  <Input
                    type="number"
                    min="1"
                    max="10"
                    value={formData.bitterness}
                    onChange={(e) => setFormData(prev => ({ ...prev, bitterness: e.target.value }))}
                    placeholder="5"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-2 text-foreground">Сладость (1-10)</label>
                  <Input
                    type="number"
                    min="1"
                    max="10"
                    value={formData.sweetness}
                    onChange={(e) => setFormData(prev => ({ ...prev, sweetness: e.target.value }))}
                    placeholder="5"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm mb-2 text-foreground">Текст в карточке</label>
              <Textarea
                value={formData.cardText}
                onChange={(e) => setFormData(prev => ({ ...prev, cardText: e.target.value }))}
                placeholder="Обработка, регион, сорт зерна и т.д."
                rows={8}
              />
            </div>

            <div>
              <label className="block text-sm mb-2 text-foreground">Полное описание (до 1000 символов)</label>
              <Textarea
                value={formData.longDescription}
                onChange={(e) => setFormData(prev => ({ ...prev, longDescription: e.target.value.slice(0, 1000) }))}
                placeholder="Подробное описание товара..."
                rows={5}
                maxLength={1000}
              />
              <div className="text-xs text-muted-foreground text-right">
                {formData.longDescription.length}/1000
              </div>
            </div>

            {/* ── Ферма ── */}
            <div className="border-t border-border pt-4">
              <h4 className="text-sm font-medium text-foreground mb-1">Фотографии фермы</h4>
              <p className="text-xs text-muted-foreground mb-4">До 10 фото. Перетаскивайте для изменения порядка, стрелки — для точного перемещения.</p>

              {farmPhotos.length > 0 && (
                <div className="flex flex-wrap gap-4 mb-4 p-3 bg-muted/20 rounded-xl border border-border">
                  {farmPhotos.map((url, i) => (
                    <DraggableFarmPhoto
                      key={url + i}
                      url={url}
                      index={i}
                      total={farmPhotos.length}
                      onMove={(from, to) => {
                        setFarmPhotos(prev => {
                          const updated = [...prev];
                          const [moved] = updated.splice(from, 1);
                          updated.splice(to, 0, moved);
                          return updated;
                        });
                      }}
                      onDelete={(idx) => setFarmPhotos(prev => prev.filter((_, j) => j !== idx))}
                    />
                  ))}
                </div>
              )}

              {farmPhotos.length < 10 && (
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById('farm-photo-upload')?.click()}
                    disabled={isUploadingFarm}
                  >
                    {isUploadingFarm ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Загрузка...</>
                    ) : (
                      <><Upload className="w-4 h-4 mr-2" />Добавить фото ({farmPhotos.length}/10)</>
                    )}
                  </Button>
                  <input
                    id="farm-photo-upload"
                    type="file"
                    accept="image/jpeg,image/png"
                    multiple
                    onChange={async (e) => {
                      const files = Array.from(e.target.files || []);
                      if (!files.length) return;
                      const remaining = 10 - farmPhotos.length;
                      const toUpload = files.slice(0, remaining);
                      if (files.length > remaining) {
                        toast.warning(`Можно добавить только ещё ${remaining} фото. Первые ${remaining} будут загружены.`);
                      }
                      setIsUploadingFarm(true);
                      const uploaded: string[] = [];
                      for (const file of toUpload) {
                        if (!file.type.match(/^image\/(jpeg|png)$/)) { toast.error(`${file.name}: только JPEG или PNG`); continue; }
                        if (file.size > 30 * 1024 * 1024) { toast.error(`${file.name}: максимум 30 МБ`); continue; }
                        try {
                          const url = await uploadRetailImage(file);
                          uploaded.push(url);
                        } catch { toast.error(`Не удалось загрузить ${file.name}`); }
                      }
                      if (uploaded.length) {
                        setFarmPhotos(prev => [...prev, ...uploaded]);
                        toast.success(`Загружено ${uploaded.length} фото`);
                      }
                      setIsUploadingFarm(false);
                      e.target.value = '';
                    }}
                    className="hidden"
                  />
                  <span className="text-xs text-muted-foreground">Можно выбрать несколько файлов сразу</span>
                </div>
              )}
            </div>

            {/* ── Рекомендую ── */}
            <div className="border-t border-border pt-4">
              <div className="flex items-center justify-between p-4 bg-[#FFF4E5]/60 rounded-xl border border-[#FF90A1]/30">
                <div>
                  <h4 className="text-sm font-medium text-foreground">Рекомендую</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">На карточке товара появится анимированный стикер «Рекомендует Вуш»</p>
                </div>
                <Switch
                  checked={formData.recommended}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, recommended: checked }))}
                />
              </div>
            </div>

            {/* СДЭК параметры упаковки */}
            <div className="border-t border-border pt-4">
              <h4 className="text-sm font-medium text-foreground mb-4">Параметры для доставки СДЭК</h4>
              <p className="text-xs text-muted-foreground mb-4">Эти поля не отображаются покупателям и используются только для расчета стоимости доставки</p>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm mb-2 text-foreground">Длина (см)</label>
                  <Input
                    type="number"
                    value={formData.packageLength}
                    onChange={(e) => setFormData(prev => ({ ...prev, packageLength: e.target.value }))}
                    placeholder="0"
                    min="0"
                    step="0.1"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-2 text-foreground">Высота (см)</label>
                  <Input
                    type="number"
                    value={formData.packageHeight}
                    onChange={(e) => setFormData(prev => ({ ...prev, packageHeight: e.target.value }))}
                    placeholder="0"
                    min="0"
                    step="0.1"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-2 text-foreground">Ширина (см)</label>
                  <Input
                    type="number"
                    value={formData.packageWidth}
                    onChange={(e) => setFormData(prev => ({ ...prev, packageWidth: e.target.value }))}
                    placeholder="0"
                    min="0"
                    step="0.1"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-2 text-foreground">Вес (граммы)</label>
                  <Input
                    type="number"
                    value={formData.packageWeight}
                    onChange={(e) => setFormData(prev => ({ ...prev, packageWeight: e.target.value }))}
                    placeholder="0"
                    min="0"
                    step="1"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm mb-2 text-foreground">
                Изображение (1000x1000, JPEG/PNG, до 10 МБ)
              </label>
              <div className="flex items-center gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => document.getElementById('image-upload')?.click()}
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Загрузка...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Загрузить
                    </>
                  )}
                </Button>
                <input
                  id="image-upload"
                  type="file"
                  accept="image/jpeg,image/png"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                {formData.imageUrl && (
                  <div className="flex items-center gap-2">
                    <img
                      src={formData.imageUrl}
                      alt="Preview"
                      className="w-12 h-12 object-cover rounded border border-border"
                    />
                    <span className="text-sm text-muted-foreground">Загружено</span>
                  </div>
                )}
              </div>
            </div>

              <div className="flex gap-2 pt-4 border-t border-border sticky bottom-0 bg-white">
                <Button type="submit" disabled={isUploading}>
                  {editingId ? 'Сохранить' : 'Создать'}
                </Button>
                <Button type="button" variant="outline" onClick={handleCancel}>
                  Отмена
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

        {/* Products Table */}
        {products.length === 0 ? (
          <div className="text-center text-muted-foreground py-12 border border-border rounded-lg">
            Нет товаров
          </div>
        ) : (
          <div className="space-y-6">
            {orderedCategories.map((category, catIndex) => {
              const categoryProducts = groupedProducts[category];
              return (
                <div key={category} className="border border-border rounded-lg overflow-hidden">
                  <div className="bg-muted px-4 py-3 border-b border-border flex items-center justify-between">
                    <h3 className="text-foreground font-medium">{category}</h3>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => moveCategoryUp(catIndex)}
                        disabled={catIndex === 0}
                        className="p-1 rounded hover:bg-muted-foreground/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        title="Переместить категорию выше"
                      >
                        <ChevronUp className="w-4 h-4 text-muted-foreground" />
                      </button>
                      <button
                        onClick={() => moveCategoryDown(catIndex)}
                        disabled={catIndex === orderedCategories.length - 1}
                        className="p-1 rounded hover:bg-muted-foreground/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        title="Переместить категорию ниже"
                      >
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      </button>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left p-4 text-sm text-foreground w-12"></th>
                          <th className="text-left p-4 text-sm text-foreground">Фото</th>
                          <th className="text-left p-4 text-sm text-foreground">Название</th>
                          <th className="text-left p-4 text-sm text-foreground">Категория</th>
                          <th className="text-left p-4 text-sm text-foreground">Описание</th>
                          <th className="text-left p-4 text-sm text-foreground">Цена</th>
                          <th className="text-right p-4 text-sm text-foreground">Действия</th>
                        </tr>
                      </thead>
                      <tbody>
                        {categoryProducts.map((product, productIndex) => (
                          <DraggableRow
                            key={product.id}
                            index={productIndex}
                            category={category}
                            product={product}
                            moveProduct={moveProduct}
                            onSaveOrder={saveProductOrder}
                            onEdit={handleEdit}
                            onDelete={handleDelete}
                            onTogglePublished={handleTogglePublished}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DndProvider>
  );
}