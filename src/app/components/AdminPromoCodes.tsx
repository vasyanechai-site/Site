import { useState, useEffect } from 'react';
import { PromoCode } from '../types';
import { fetchPromoCodes, createPromoCode, updatePromoCode, deletePromoCode } from '../lib/api';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from './ui/dialog';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Loader2, Plus, Pencil, Trash2 } from 'lucide-react';

export function AdminPromoCodes() {
  const [promos, setPromos] = useState<PromoCode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  // Form state
  const [code, setCode] = useState('');
  const [discount, setDiscount] = useState('');
  const [maxUses, setMaxUses] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  
  useEffect(() => {
    loadPromos();
  }, []);

  const loadPromos = async () => {
    try {
      setIsLoading(true);
      const data = await fetchPromoCodes();
      // Sort: active first, then by creation date
      const sorted = data.sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime());
      setPromos(sorted);
    } catch (error) {
      console.error('Failed to load promos:', error);
      toast.error('Не удалось загрузить промокоды');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setCode('');
    setDiscount('');
    setMaxUses('');
    setExpiresAt('');
    setIsEditing(false);
  };

  const handleCreate = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const handleEdit = (promo: PromoCode) => {
    setCode(promo.code);
    setDiscount(promo.discountPercent.toString());
    setMaxUses(promo.maxUses.toString());
    setExpiresAt(promo.expiresAt.split('T')[0]); // Extract date part for input type="date"
    setIsEditing(true);
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Устанавливаем конец дня для даты окончания
      const expiryDate = new Date(expiresAt);
      expiryDate.setHours(23, 59, 59, 999);

      const promoData = {
        code: code.toUpperCase(),
        discountPercent: Number(discount),
        maxUses: Number(maxUses),
        expiresAt: expiryDate.toISOString(),
      };

      if (isEditing) {
        await updatePromoCode(code, promoData);
        toast.success('Промокод обновлен');
      } else {
        await createPromoCode({
            ...promoData,
            usedCount: 0,
            isActive: true
        } as PromoCode);
        toast.success('Промокод создан');
      }
      
      setIsDialogOpen(false);
      loadPromos();
    } catch (error) {
      console.error('Failed to save promo:', error);
      toast.error('Ошибка при сохранении');
    }
  };

  const handleDelete = async (code: string) => {
    if (!confirm('Вы уверены, что хотите удалить этот промокод?')) return;
    
    try {
      await deletePromoCode(code);
      toast.success('Промокод удален');
      loadPromos();
    } catch (error) {
      toast.error('Ошибка удаления');
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Промокоды</h2>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Создать промокод
        </Button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Код</TableHead>
                <TableHead>Скидка</TableHead>
                <TableHead>Использовано</TableHead>
                <TableHead>Истекает</TableHead>
                <TableHead className="text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {promos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                    Нет активных промокодов
                  </TableCell>
                </TableRow>
              ) : (
                promos.map((promo) => (
                  <TableRow key={promo.code}>
                    <TableCell className="font-medium">{promo.code}</TableCell>
                    <TableCell>{promo.discountPercent}%</TableCell>
                    <TableCell>
                      {promo.usedCount} / {promo.maxUses}
                    </TableCell>
                    <TableCell>
                      {format(new Date(promo.expiresAt), 'dd.MM.yyyy')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(promo)}>
                              <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(promo.code)}>
                              <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Редактировать промокод' : 'Новый промокод'}</DialogTitle>
            <DialogDescription>
              Заполните форму для {isEditing ? 'редактирования' : 'создания'} промокода.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Код</Label>
              <Input 
                value={code} 
                onChange={e => setCode(e.target.value.toUpperCase())} 
                placeholder="SALE2024"
                disabled={isEditing} // Code is ID, cannot change
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Скидка (%)</Label>
                <Input 
                  type="number" 
                  min="1" 
                  max="100"
                  value={discount} 
                  onChange={e => setDiscount(e.target.value)} 
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Кол-во использований</Label>
                <Input 
                  type="number" 
                  min="1"
                  value={maxUses} 
                  onChange={e => setMaxUses(e.target.value)} 
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Дата окончания</Label>
              <Input 
                type="date" 
                value={expiresAt} 
                onChange={e => setExpiresAt(e.target.value)} 
                required
              />
            </div>
            <DialogFooter>
              <Button type="submit">{isEditing ? 'Сохранить' : 'Создать'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}