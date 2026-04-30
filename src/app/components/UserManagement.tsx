import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { fetchUsersAdmin, createUser, deleteUser, updateUser } from '../lib/api';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Plus, Trash2, Pencil, RotateCcw, UserCheck, Search, X, Zap, Lock, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
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
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { fetchAgents } from '../lib/agentApi';
import type { Agent } from '../types/agent';

// Компонент заголовка с сортировкой
function SortHeader({
  label,
  field,
  sortField,
  sortDir,
  onSort,
  className = '',
}: {
  label: string;
  field: string;
  sortField: string;
  sortDir: 'asc' | 'desc';
  onSort: (f: string) => void;
  className?: string;
}) {
  const active = sortField === field;
  return (
    <th
      className={`px-6 py-4 text-foreground text-sm cursor-pointer select-none whitespace-nowrap ${className}`}
      onClick={() => onSort(field)}
    >
      <span className="inline-flex items-center gap-1 hover:text-foreground/70 transition-colors">
        {label}
        {active ? (
          sortDir === 'asc'
            ? <ChevronUp className="w-3.5 h-3.5 text-primary" />
            : <ChevronDown className="w-3.5 h-3.5 text-primary" />
        ) : (
          <ChevronsUpDown className="w-3.5 h-3.5 text-muted-foreground/50" />
        )}
      </span>
    </th>
  );
}

export function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [deleteUserName, setDeleteUserName] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);

  // Фильтры
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'direct' | 'agent'>('all');
  const [agentFilter, setAgentFilter] = useState<string>('all');

  // Сортировка
  const [sortField, setSortField] = useState<string>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const [formData, setFormData] = useState({
    phone: '',
    password: '',
    company_name: '',
    email: '',
    loyaltyLevel: '0',
    role: 'wholesale' as 'wholesale' | 'admin',
  });

  useEffect(() => {
    loadUsers();
    fetchAgents().then(setAgents).catch(() => {});
  }, []);

  const loadUsers = async () => {
    try {
      setIsLoading(true);
      const fetchedUsers = await fetchUsersAdmin();
      setUsers(fetchedUsers);
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({ phone: '', password: '', company_name: '', email: '', loyaltyLevel: '0', role: 'wholesale' });
  };

  const getDiscountForLevel = (level: number) => {
    switch (level) {
      case 3: return 10;
      case 2: return 7;
      case 1: return 5;
      default: return 0;
    }
  };

  const handleAdd = async () => {
    if (formData.phone && formData.password && formData.company_name) {
      try {
        const level = parseInt(formData.loyaltyLevel);
        await createUser({
          phone: formData.phone,
          password: formData.password,
          company_name: formData.company_name,
          email: formData.email || undefined,
          discount: getDiscountForLevel(level),
          loyaltyLevel: level,
          loyaltyLevelSetDate: new Date().toISOString(),
          role: formData.role,
        });
        await loadUsers();
        resetForm();
        setIsAddDialogOpen(false);
        toast.success('Пользователь добавлен');
      } catch (error) {
        console.error('Failed to add user:', error);
        toast.error('Не удалось добавить пользователя');
      }
    }
  };

  const handleDelete = async () => {
    if (deleteUserId) {
      const toastId = toast.loading('🔄 Удаление пользователя...');
      try {
        await deleteUser(deleteUserId);
        await loadUsers();
        setDeleteUserId(null);
        setDeleteUserName('');
        toast.success('✅ Пользователь успешно удален!', { id: toastId });
      } catch (error: any) {
        console.error('Failed to delete user:', error);
        toast.error(`❌ Ошибка удаления: ${error?.message || 'Неизвестная ошибка'}`, { id: toastId });
      }
    }
  };

  const handleEdit = async () => {
    if (editingUser && formData.phone && formData.company_name) {
      try {
        const level = parseInt(formData.loyaltyLevel);
        const isLevelChanged = editingUser.loyaltyLevel !== level;
        const setDate = isLevelChanged
          ? new Date().toISOString()
          : (editingUser.loyaltyLevelSetDate || new Date().toISOString());

        await updateUser(editingUser.id, {
          phone: formData.phone,
          password: formData.password,
          company_name: formData.company_name,
          email: formData.email || undefined,
          discount: getDiscountForLevel(level),
          loyaltyLevel: level,
          loyaltyLevelSetDate: setDate,
          loyaltyLevelManualOverride: true, // Admin manually set → lock
          role: formData.role,
        });
        await loadUsers();
        resetForm();
        setIsEditDialogOpen(false);
        setEditingUser(null);
        toast.success('Пользователь обновлен');
      } catch (error) {
        console.error('Failed to update user:', error);
        toast.error('Не удалось обновить пользователя');
      }
    }
  };

  /** Сбросить ручной override — дать системе пересчитать уровень по кг */
  const handleResetAutoLevel = async (user: User) => {
    try {
      await updateUser(user.id, { loyaltyLevelManualOverride: false });
      await loadUsers();
      toast.success(`Уровень ${user.company_name} сброшен на авто`);
    } catch (error) {
      toast.error('Не удалось сбросить уровень');
    }
  };

  const handleResetAll = async () => {
    try {
      setIsLoading(true);
      await Promise.all(
        users.map(u => updateUser(u.id, { discount: 0, loyaltyLevel: 0, loyaltyLevelSetDate: new Date().toISOString(), loyaltyLevelManualOverride: false }))
      );
      await loadUsers();
      setIsResetDialogOpen(false);
      toast.success('Все скидки сброшены');
    } catch (error) {
      toast.error('Не удалось сбросить скидки');
    } finally {
      setIsLoading(false);
    }
  };

  const getUsersWithoutCompany = () => users.filter(u => !u.company_name || u.company_name.trim() === '');

  const handleBulkDeleteWithoutCompany = async () => {
    const toDelete = getUsersWithoutCompany();
    const toastId = toast.loading(`🔄 Удаление ${toDelete.length} пользователей...`);
    try {
      setIsLoading(true);
      await Promise.all(toDelete.map(u => deleteUser(u.id)));
      await loadUsers();
      setIsBulkDeleteDialogOpen(false);
      toast.success(`✅ Удалено ${toDelete.length} пользователей!`, { id: toastId });
    } catch (error: any) {
      toast.error(`❌ Ошибка: ${error?.message}`, { id: toastId });
    } finally {
      setIsLoading(false);
    }
  };

  // Тест подключения
  const handleTestServer = async () => {
    const toastId = toast.loading('🔍 Тестирование подключения...');
    try {
      const testUserId = users.length > 0 ? users[0].id : 'test-id-123';
      const url = `https://${projectId}.supabase.co/functions/v1/make-server-aa167a09/users/${testUserId}`;
      const response = await fetch(url, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json' },
      });
      const text = await response.text();
      toast.success(`Статус: ${response.status} — ${text}`, { id: toastId });
    } catch (error: any) {
      toast.error(`Ошибка сети: ${error.message}`, { id: toastId });
    }
  };

  // Отфильтрованные пользователи
  const filteredUsers = users
    .filter(u => u.company_name && u.company_name.trim() !== '')
    .filter(u => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (u.company_name || '').toLowerCase().includes(q) || u.phone.toLowerCase().includes(q);
    })
    .filter(u => {
      const aid = (u as any).agent_id;
      if (sourceFilter === 'direct') return !aid;
      if (sourceFilter === 'agent') return !!aid;
      return true;
    })
    .filter(u => agentFilter === 'all' || (u as any).agent_id === agentFilter)
    .sort((a, b) => {
      let cmp = 0;
      if (sortField === 'created_at') {
        const aDate = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bDate = b.created_at ? new Date(b.created_at).getTime() : 0;
        cmp = aDate - bDate;
      } else if (sortField === 'company_name') {
        cmp = (a.company_name || '').localeCompare(b.company_name || '', 'ru');
      } else if (sortField === 'loyaltyLevel') {
        cmp = (a.loyaltyLevel || 0) - (b.loyaltyLevel || 0);
      } else if (sortField === 'discount') {
        cmp = (a.discount || 0) - (b.discount || 0);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-foreground">Управление пользователями</h2>
        <div className="flex gap-2">
          <Button variant="outline" className="text-red-500 hover:text-red-600" onClick={() => setIsResetDialogOpen(true)}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Сбросить скидки
          </Button>
          <Button onClick={() => { resetForm(); setIsAddDialogOpen(true); }} className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Добавить пользователя
          </Button>
        </div>
      </div>

      {/* ── Панель фильтров ── */}
      <div className="mb-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Поиск по компании или телефону..."
            className="pl-9 pr-9"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-border overflow-hidden">
            {(['all', 'direct', 'agent'] as const).map(v => (
              <button
                key={v}
                onClick={() => { setSourceFilter(v); setAgentFilter('all'); }}
                className={`px-3 py-1.5 text-sm transition-colors ${sourceFilter === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
              >
                {v === 'all' ? 'Все' : v === 'direct' ? 'Прямые' : 'От агентов'}
              </button>
            ))}
          </div>

          {sourceFilter === 'agent' && agents.length > 0 && (
            <Select value={agentFilter} onValueChange={setAgentFilter}>
              <SelectTrigger className="w-48 h-9">
                <SelectValue placeholder="Все агенты" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все агенты</SelectItem>
                {agents.map(a => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <span className="text-sm text-muted-foreground ml-auto">
            Показано: {filteredUsers.length} из {users.filter(u => u.company_name && u.company_name.trim() !== '').length}
          </span>
        </div>
      </div>

      {isLoading ? (
        <div className="border border-border rounded-lg p-12 flex items-center justify-center">
          <p className="text-muted-foreground">Загрузка...</p>
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <SortHeader label="Организация" field="company_name" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="text-left" />
                  <th className="text-left px-6 py-4 text-foreground text-sm">Телефон</th>
                  <th className="text-left px-6 py-4 text-foreground text-sm">Email</th>
                  <SortHeader label="Ступень" field="loyaltyLevel" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="text-left" />
                  <SortHeader label="Скидка" field="discount" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="text-left" />
                  <SortHeader label="Дата создания" field="created_at" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="text-left" />
                  <th className="text-center px-6 py-4 text-foreground text-sm">Действия</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                      {searchQuery || sourceFilter !== 'all'
                        ? 'Ничего не найдено. Попробуйте изменить фильтры.'
                        : 'Пользователи не найдены'}
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user, index) => {
                    const creatingAgent = (user as any).agent_id
                      ? agents.find(a => a.id === (user as any).agent_id)
                      : null;
                    return (
                      <tr key={user.id || `user-${index}`} className="border-b border-border hover:bg-muted/50">
                        <td className="px-6 py-4 text-sm text-foreground">
                          <div>{user.company_name}</div>
                          {creatingAgent && (
                            <span className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded bg-[#FFF4E5] text-[#F47D37] font-medium border border-[#F47D37]/20 mt-0.5">
                              <UserCheck className="w-2.5 h-2.5" />
                              от агента: {creatingAgent.name}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-foreground text-sm">{user.phone}</td>
                        <td className="px-6 py-4 text-sm text-muted-foreground">
                          {user.email ? (
                            <a href={`mailto:${user.email}`} className="hover:text-foreground transition-colors">
                              {user.email}
                            </a>
                          ) : (
                            <span className="text-muted-foreground/40">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-foreground text-sm">
                          {user.loyaltyLevel ? `Ступень ${user.loyaltyLevel}` : 'Базовый'}
                        </td>
                        <td className="px-6 py-4 text-foreground text-sm">{user.discount ? `${user.discount}%` : '0%'}</td>
                        <td className="px-6 py-4 text-foreground text-sm">
                          {user.created_at ? new Date(user.created_at).toLocaleDateString('ru-RU') : '-'}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setDeleteUserId(user.id);
                                setDeleteUserName(user.company_name || user.phone);
                              }}
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditingUser(user);
                                setFormData({
                                  phone: user.phone,
                                  password: '',
                                  company_name: user.company_name || '',
                                  email: user.email || '',
                                  loyaltyLevel: String(user.loyaltyLevel || 0),
                                  role: (user.role || 'wholesale') as 'wholesale' | 'admin',
                                });
                                setIsEditDialogOpen(true);
                              }}
                            >
                              <Pencil className="w-4 h-4 text-blue-500" />
                            </Button>
                            {user.loyaltyLevelManualOverride && (
                              <Button
                                variant="outline"
                                size="sm"
                                title="Уровень задан вручную. Нажмите чтобы сбросить на авто"
                                onClick={() => handleResetAutoLevel(user)}
                              >
                                <Lock className="w-4 h-4 text-gray-500" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-foreground">Добавить пользователя</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Создайте нового пользователя. Выберите ступень лояльности.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="add-phone">Телефон</Label>
              <Input id="add-phone" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} placeholder="89991234567" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-password">Пароль</Label>
              <Input id="add-password" type="text" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} placeholder="Введите пароль" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-company">Название компании</Label>
              <Input id="add-company" value={formData.company_name} onChange={e => setFormData({ ...formData, company_name: e.target.value })} placeholder="Введите название компании" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-email">Email</Label>
              <Input id="add-email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="Введите email" />
            </div>
            <div className="space-y-2">
              <Label>Ступень лояльности</Label>
              <Select value={formData.loyaltyLevel} onValueChange={v => setFormData({ ...formData, loyaltyLevel: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Ступень 0 — Случайный визит (0%)</SelectItem>
                  <SelectItem value="1">Ступень 1 — Нечайная встреча (5%)</SelectItem>
                  <SelectItem value="2">Ступень 2 — Приятная нечайность (7%)</SelectItem>
                  <SelectItem value="3">Ступень 3 — Главный Нечай (10%)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Роль</Label>
              <Select value={formData.role} onValueChange={(v: 'wholesale' | 'admin') => setFormData({ ...formData, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="wholesale">Оптовый клиент</SelectItem>
                  <SelectItem value="admin">Администратор</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleAdd} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">Сохранить</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-foreground">Редактировать пользователя</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Обновите информацию о пользователе и его ступени лояльности.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="edit-phone">Телефон</Label>
              <Input id="edit-phone" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-password">Пароль</Label>
              <Input id="edit-password" type="text" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} placeholder="Новый пароль (необязательно)" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-company">Название компании</Label>
              <Input id="edit-company" value={formData.company_name} onChange={e => setFormData({ ...formData, company_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input id="edit-email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="Введите email" />
            </div>
            <div className="space-y-2">
              <Label>Ступень лояльности</Label>
              <Select value={formData.loyaltyLevel} onValueChange={v => setFormData({ ...formData, loyaltyLevel: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Ступень 0 — Случайный визит (0%)</SelectItem>
                  <SelectItem value="1">Ступень 1 — Нечайная встреча (5%)</SelectItem>
                  <SelectItem value="2">Ступень 2 — Приятная нечайность (7%)</SelectItem>
                  <SelectItem value="3">Ступень 3 — Главный Нечай (10%)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Роль</Label>
              <Select value={formData.role} onValueChange={(v: 'wholesale' | 'admin') => setFormData({ ...formData, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="wholesale">Оптовый клиент</SelectItem>
                  <SelectItem value="admin">Администратор</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleEdit} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">Сохранить</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reset all discounts */}
      <AlertDialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Сбросить все скидки?</AlertDialogTitle>
            <AlertDialogDescription>Это установит уровень лояльности 0 и скидку 0% для всех пользователей. Нельзя отменить.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleResetAll} className="bg-red-500 hover:bg-red-600 text-white">Сбросить все</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete user */}
      <AlertDialog open={deleteUserId !== null} onOpenChange={(open) => { if (!open) { setDeleteUserId(null); setDeleteUserName(''); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить пользователя?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteUserName && (
                <span className="block mb-1">
                  <span className="font-medium text-foreground">{deleteUserName}</span> будет удалён без возможности восстановления.
                </span>
              )}
              Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-500 hover:bg-red-600 text-white">Удалить</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk delete without company */}
      <AlertDialog open={isBulkDeleteDialogOpen} onOpenChange={setIsBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить пользователей без компании?</AlertDialogTitle>
            <AlertDialogDescription>
              Будет удалено {getUsersWithoutCompany().length} пользователей без названия компании. Нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDeleteWithoutCompany} className="bg-red-500 hover:bg-red-600 text-white">
              Удалить ({getUsersWithoutCompany().length})
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}