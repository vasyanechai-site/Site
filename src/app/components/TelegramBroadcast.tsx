import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Input } from './ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Loader2, Send, Upload, X, Users, CheckCircle, RefreshCw } from 'lucide-react';
import { FadeIn } from './ui/fade-in';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { toast } from 'sonner';

export function TelegramBroadcast() {
  const [text, setText] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [stats, setStats] = useState<{ total_users: number; users: any[] } | null>(null);
  const [autoCheckEnabled, setAutoCheckEnabled] = useState(true);
  const [lastCheckTime, setLastCheckTime] = useState<Date | null>(null);
  const [result, setResult] = useState<any>(null);

  // Автоматическая проверка новых сообщений
  useEffect(() => {
    if (!autoCheckEnabled) return;

    const checkForNewMessages = async () => {
      try {
        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-aa167a09/telegram/poll`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${publicAnonKey}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        const data = await response.json();
        
        if (data.ok && data.processed > 0) {
          console.log(`✅ Авто-проверка: обработано ${data.processed} новых сообщений`);
          // Автоматически обновляем статистику
          loadStats();
          toast.success(`Новый подписчик! Всего: ${data.processed}`, { duration: 3000 });
        }
        
        setLastCheckTime(new Date());
      } catch (error) {
        console.error('Error in auto-check:', error);
      }
    };

    // Первая проверка сразу
    checkForNewMessages();

    // Проверяем каждые 10 секунд
    const interval = setInterval(checkForNewMessages, 10000);

    return () => clearInterval(interval);
  }, [autoCheckEnabled]);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-aa167a09/broadcast-stats`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      } else {
        console.error('Error loading stats: HTTP', response.status, await response.text());
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Проверка типа файла
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Поддерживаются только JPG, PNG и WebP');
      return;
    }

    // Проверка размера (макс 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Размер файла не должен превышать 5MB');
      return;
    }

    setImageFile(file);

    // Создаем превью
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile) return null;

    try {
      setUploading(true);

      // Создаем FormData для отправки файла
      const formData = new FormData();
      formData.append('file', imageFile);

      // Загружаем через сервер (с service role key - обходит RLS)
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-aa167a09/upload-broadcast-image`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'X-Admin-Auth': 'true'
          },
          body: formData
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const data = await response.json();
      return data.url;

    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error(error instanceof Error ? error.message : 'Ошибка загрузки изображения');
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setImageUrl('');
  };

  const handleSendBroadcast = async () => {
    if (!text && !imageFile) {
      toast.error('Введите текст или выберите изображение');
      return;
    }

    try {
      setSending(true);
      setResult(null);

      // Загружаем изображение если есть
      let uploadedImageUrl = imageUrl;
      if (imageFile && !imageUrl) {
        uploadedImageUrl = await uploadImage();
        if (uploadedImageUrl) {
          setImageUrl(uploadedImageUrl);
        }
      }

      // Отправляем рассылку
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-aa167a09/broadcast`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`,
            'X-Admin-Auth': 'true'
          },
          body: JSON.stringify({
            text: text || null,
            imageUrl: uploadedImageUrl || null
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Ошибка отправки');
      }

      setResult(data);
      toast.success(`Рассылка отправлена ${data.sent} пользователям`);

      // Очищаем форму после успешной отправки
      setText('');
      handleRemoveImage();
    } catch (error) {
      console.error('Error sending broadcast:', error);
      toast.error(error instanceof Error ? error.message : 'Ошибка отправки');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <FadeIn>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-foreground">Telegram Рассылка</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Отправьте сообщение всем подписчикам Telegram-бота
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                loadStats();
                toast.success('Статистика обновлена');
              }}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Обновить
            </Button>
            <Button
              variant={autoCheckEnabled ? "default" : "outline"}
              size="sm"
              onClick={() => setAutoCheckEnabled(!autoCheckEnabled)}
              className="relative"
            >
              {autoCheckEnabled && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              )}
              {autoCheckEnabled ? '✓ Авто-провека' : 'Авто-проверка'}
            </Button>
            {lastCheckTime && (
              <span className="text-xs text-muted-foreground">
                Проверено: {lastCheckTime.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            )}
            {stats && (
              <div className="flex items-center gap-2 bg-muted/30 px-4 py-2 rounded-lg border border-border">
                <Users className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">{stats.total_users} подписчиков</span>
              </div>
            )}
          </div>
        </div>
      </FadeIn>

      {/* Форма отправки */}
      <FadeIn delay={0.1}>
        <Card>
          <CardHeader>
            <CardTitle>Создать рассылку</CardTitle>
            <CardDescription>
              Добавьте текст сообщения и/или изображение
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Текст сообщения */}
            <div className="space-y-2">
              <Label htmlFor="broadcast_text">Текст сообщения</Label>
              <Textarea
                id="broadcast_text"
                placeholder="Введите текст рассылки... (поддерживается HTML)"
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={6}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Можно использовать HTML теи: <b>жирный</b>, <i>курсив</i>, <a href="...">ссылка</a>
              </p>
            </div>

            {/* Загрузка изображения */}
            <div className="space-y-2">
              <Label htmlFor="broadcast_image">Изображение (необязательно)</Label>
              {!imagePreview ? (
                <div className="relative">
                  <Input
                    id="broadcast_image"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleImageSelect}
                    className="hidden"
                  />
                  <label
                    htmlFor="broadcast_image"
                    className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                  >
                    <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                    <span className="text-sm text-muted-foreground">
                      Нажмите для выбора изображения
                    </span>
                    <span className="text-xs text-muted-foreground mt-1">
                      JPG, PNG или WebP (макс. 5MB)
                    </span>
                  </label>
                </div>
              ) : (
                <div className="relative">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-full h-48 object-cover rounded-lg border border-border"
                  />
                  <button
                    onClick={handleRemoveImage}
                    className="absolute top-2 right-2 p-1 bg-destructive text-white rounded-full hover:bg-destructive/90 transition-colors"
                    disabled={uploading || sending}
                  >
                    <X className="w-4 h-4" />
                  </button>
                  {imageUrl && (
                    <div className="absolute bottom-2 left-2 bg-green-500 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      Загружено
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Кнопка отправки */}
            <Button
              onClick={handleSendBroadcast}
              disabled={(!text && !imageFile) || sending || uploading}
              className="w-full"
              size="lg"
            >
              {sending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Отправка...
                </>
              ) : uploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Загрузка изображения...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Отправить рассылку
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </FadeIn>

      {/* Список подписчиков */}
      {stats && stats.users && stats.users.length > 0 && (
        <FadeIn delay={0.2}>
          <Card>
            <CardHeader>
              <CardTitle>Подписчики ({stats.users.length})</CardTitle>
              <CardDescription>
                Список всех пользователей, подписанных на рассылку
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-3">Chat ID</th>
                      <th className="text-left py-2 px-3">Имя</th>
                      <th className="text-left py-2 px-3">Username</th>
                      <th className="text-left py-2 px-3">Дата подписки</th>
                      <th className="text-left py-2 px-3">Тип</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.users.map((user, idx) => (
                      <tr key={user.chat_id} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="py-2 px-3 font-mono text-xs">{user.chat_id}</td>
                        <td className="py-2 px-3">{user.first_name || '—'}</td>
                        <td className="py-2 px-3 text-muted-foreground">
                          {user.username ? `@${user.username}` : '—'}
                        </td>
                        <td className="py-2 px-3 text-muted-foreground">
                          {new Date(user.created_at).toLocaleString('ru-RU', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </td>
                        <td className="py-2 px-3">
                          {user.test_user ? (
                            <span className="text-xs bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 px-2 py-1 rounded">
                              Тест
                            </span>
                          ) : (
                            <span className="text-xs bg-green-500/10 text-green-600 dark:text-green-400 px-2 py-1 rounded">
                              Реальный
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </FadeIn>
      )}
    </div>
  );
}