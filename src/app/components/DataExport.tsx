import { useState } from 'react';
import { Button } from './ui/button';
import { Download } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { FadeIn } from './ui/fade-in';
import { toast } from 'sonner';
import { API_BASE_URL } from '../lib/backendConfig';

export function DataExport() {
  const [loading, setLoading] = useState(false);

  const downloadFullBackup = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/full-export`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      const name = `nechai-full-backup-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.json`;
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('Файл бэкапа скачан');
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : 'Ошибка экспорта');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <FadeIn>
        <div>
          <h2 className="text-foreground mb-2">Экспорт / бэкап базы</h2>
          <p className="text-sm text-muted-foreground">
            Один файл JSON: опт и розница — товары опта, заказы опта и розницы, пользователи и розничные аккаунты,
            промокоды, избранное, заявки, локации, бегущая строка, курс, лояльность розницы, настройки. Сохраните файл
            для восстановления (в т.ч. подмена <code className="text-xs bg-muted px-1 rounded">server/data/db.json</code> в
            файловом режиме — только если понимаете риски).
          </p>
        </div>
      </FadeIn>

      <FadeIn delay={0.1}>
        <Alert>
          <Download className="h-4 w-4" />
          <AlertTitle>Скачать полный бэкап</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>Данные собираются на сервере из базы (Postgres или локальный JSON).</p>
            <Button onClick={() => void downloadFullBackup()} disabled={loading} className="gap-2">
              <Download className="w-4 h-4" />
              {loading ? 'Сбор данных…' : 'Скачать полный JSON-бэкап'}
            </Button>
          </AlertDescription>
        </Alert>
      </FadeIn>
    </div>
  );
}
