import { useState, useRef } from 'react';
import { Button } from './ui/button';
import { Upload, FileJson, AlertCircle } from 'lucide-react@0.454.0';
import { FadeIn } from './ui/fade-in';

export function DataImport() {
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState('');
  const [importPreview, setImportPreview] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      // Проверяем структуру данных
      if (!data.data || !data.data.coffeeItems || !data.data.orders || !data.data.users) {
        setImportStatus('Ошибка: неверный формат файла');
        return;
      }

      setImportPreview(data);
      setImportStatus('');
    } catch (error) {
      console.error('File parsing error:', error);
      setImportStatus('Ошибка: не удалось прочитать файл');
      setImportPreview(null);
    }
  };

  const importData = async () => {
    if (!importPreview) return;

    try {
      setIsImporting(true);
      setImportStatus('Импорт данных...');

      const { projectId, publicAnonKey } = await import('../utils/supabase/info');
      const baseUrl = `https://${projectId}.supabase.co/functions/v1/make-server-aa167a09`;

      // Импортируем данные последовательно
      // 1. Прайс
      const coffeeResponse = await fetch(`${baseUrl}/coffee-items`, {
        method: 'PUT',
        headers: { 
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(importPreview.data.coffeeItems)
      });

      if (!coffeeResponse.ok) {
        throw new Error('Ошибка импорта прайса');
      }

      // 2. Пользователи
      for (const user of importPreview.data.users) {
        await fetch(`${baseUrl}/users`, {
          method: 'POST',
          headers: { 
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(user)
        });
      }

      // 3. Заказы
      for (const order of importPreview.data.orders) {
        await fetch(`${baseUrl}/orders`, {
          method: 'POST',
          headers: { 
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(order)
        });
      }

      setImportStatus(`Успешно импортировано: ${importPreview.stats.totalCoffeeItems} позиций кофе, ${importPreview.stats.totalOrders} заказов, ${importPreview.stats.totalUsers} пользователей`);
      setImportPreview(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Import error:', error);
      setImportStatus('Ошибка при импорте данных');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <FadeIn>
        <div>
          <h2 className="text-foreground mb-2">Импорт данных</h2>
          <p className="text-sm text-muted-foreground">
            Импортируйте данные из JSON-файла, полученного через функцию экспорта
          </p>
        </div>
      </FadeIn>

      <FadeIn delay={0.1}>
        <div className="border border-border rounded-lg p-6 space-y-4">
          <div className="flex items-start gap-4">
            <FileJson className="w-12 h-12 text-muted-foreground flex-shrink-0" />
            <div className="flex-1">
              <h3 className="text-foreground mb-2">Загрузить JSON файл</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Выберите файл экспорта для импорта данных в текущий проект
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileSelect}
                className="hidden"
                id="import-file"
              />
              <label htmlFor="import-file">
                <Button
                  type="button"
                  variant="outline"
                  className="flex items-center gap-2"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-4 h-4" />
                  Выбрать файл
                </Button>
              </label>
            </div>
          </div>

          {importPreview && (
            <div className="border-t border-border pt-4 mt-4">
              <h4 className="text-foreground mb-3">Предпросмотр импорта</h4>
              <div className="bg-muted/30 rounded-lg p-4 space-y-2 mb-4">
                <p className="text-sm text-foreground">
                  📅 Дата экспорта: {new Date(importPreview.exportDate).toLocaleString('ru-RU')}
                </p>
                <p className="text-sm text-foreground">
                  ☕ Позиций кофе: {importPreview.stats.totalCoffeeItems}
                </p>
                <p className="text-sm text-foreground">
                  📦 Заказов: {importPreview.stats.totalOrders}
                </p>
                <p className="text-sm text-foreground">
                  👥 Пользователей: {importPreview.stats.totalUsers}
                </p>
              </div>
              <Button
                onClick={importData}
                disabled={isImporting}
                className="flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                {isImporting ? 'Импорт...' : 'Импортировать данные'}
              </Button>
            </div>
          )}

          {importStatus && (
            <div className={`p-4 rounded-lg ${importStatus.includes('Ошибка') ? 'bg-destructive/10 text-destructive border border-destructive/20' : 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800'}`}>
              <p className="text-sm">{importStatus}</p>
            </div>
          )}
        </div>
      </FadeIn>

      <FadeIn delay={0.2}>
        <div className="border border-yellow-200 dark:border-yellow-800 rounded-lg p-6 bg-yellow-50 dark:bg-yellow-900/30">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-700 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-yellow-900 dark:text-yellow-200 mb-2">Внимание</h3>
              <p className="text-sm text-yellow-800 dark:text-yellow-300">
                Импорт данных перезапишет существующие данные. Убедитесь, что вы импортируете правильный файл.
                Рекомендуется сначала экспортировать текущие данные для резервной копии.
              </p>
            </div>
          </div>
        </div>
      </FadeIn>
    </div>
  );
}