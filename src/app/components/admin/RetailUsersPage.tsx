import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { projectId } from '../../utils/supabase/info';
import { API_BASE_URL } from '../../lib/backendConfig';

import { Button } from '../ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { toast } from 'sonner';
import { Loader2, Trash2, Shield, Plus, Users } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

interface RetailUser {
  id: string;
  email: string;
  role: string;
  created_at: string;
}

export function RetailUsersPage() {
  const [users, setUsers] = useState<RetailUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState('user');

  const fetchUsers = async () => {
    setLoading(true);
    
    try {
      // Админ-панель открыта, используем publicAnonKey
      const { publicAnonKey } = await import('../../utils/supabase/info');
      
      const url = `${API_BASE_URL}/retail-users`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch users');
      }

      const data = await response.json();
      
      console.log('👥 Fetched retail users:', data.users?.length || 0);
      setUsers(data.users || []);
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Не удалось загрузить пользователей');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Админ-панель открыта для всех - загружаем данные сразу
    fetchUsers();
  }, []);

  const handleDelete = async (id: string, email: string) => {
    if (!confirm(`Вы уверены, что хотите удалить пользователя ${email}?`)) return;

    setDeletingId(id);
    try {
      // Админ-панель открыта, используем publicAnonKey
      const { publicAnonKey } = await import('../../utils/supabase/info');
      
      const response = await fetch(
        `${API_BASE_URL}/retail-users/${id}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete user');
      }

      toast.success(`Пользователь ${email} удален`);
      setUsers(users.filter(u => u.id !== id));
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Ошибка при удалении пользователя');
    } finally {
      setDeletingId(null);
    }
  };

  const handleAddUser = async () => {
    if (!newUserEmail) {
      toast.error('Введите email нового пользователя');
      return;
    }

    setIsAddingUser(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`${API_BASE_URL}/retail-users`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: newUserEmail,
          role: newUserRole
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add user');
      }

      const data = await response.json();
      toast.success(`Пользователь ${newUserEmail} добавлен`);
      setUsers([...users, data.user]);
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Ошибка при добавлении пользователя');
    } finally {
      setIsAddingUser(false);
      setNewUserEmail('');
      setNewUserRole('user');
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-6xl">
      {loading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-[#FF90A1]" />
        </div>
      ) : (
        <>
        <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="w-6 h-6 text-[#FF90A1]" />
              Пользователи розницы
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchUsers}
                disabled={loading}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Обновить
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAddingUser(true)}
              >
                <Plus className="w-4 h-4" />
                Добавить пользователя
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Роль</TableHead>
                <TableHead>Дата регистрации</TableHead>
                <TableHead className="text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center h-24 text-gray-500">
                    Нет зарегистрированных пользователей
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.email}</TableCell>
                    <TableCell>
                      {user.role === 'admin' ? (
                        <div className="flex items-center gap-1.5 text-amber-600">
                          <Shield className="w-4 h-4" />
                          <span>Админ</span>
                        </div>
                      ) : (
                        <span className="text-gray-600">Пользователь</span>
                      )}
                    </TableCell>
                    <TableCell className="text-gray-600">
                      {new Date(user.created_at).toLocaleDateString('ru-RU', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center gap-2 justify-end">
                        {user.role !== 'admin' ? (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleDelete(user.id, user.email)}
                            disabled={deletingId === user.id}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          >
                            {deletingId === user.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </Button>
                        ) : (
                          <span className="text-xs text-gray-400 w-9">—</span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          
          {users.length > 0 && (
            <div className="mt-4 text-sm text-gray-500">
              Всего пользователей: {users.length} (админов: {users.filter(u => u.role === 'admin').length})
            </div>
          )}
        </CardContent>
      </Card>
        </>
      )}

      <Dialog open={isAddingUser} onOpenChange={setIsAddingUser}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Добавить нового пользователя</DialogTitle>
            <DialogDescription>
              Введите email и роль нового пользователя.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="role">Роль</Label>
              <select
                id="role"
                value={newUserRole}
                onChange={(e) => setNewUserRole(e.target.value)}
                className="col-span-3"
              >
                <option value="user">Пользователь</option>
                <option value="admin">Админ</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsAddingUser(false)}
            >
              Отмена
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleAddUser}
              disabled={isAddingUser}
            >
              {isAddingUser ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Добавить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}