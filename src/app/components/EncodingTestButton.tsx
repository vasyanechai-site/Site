import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Тестовый компонент для проверки системы исправления кодировки
 * Добавьте его в любой компонент для тестирования
 */
export function EncodingTestButton() {
  const testEncoding = () => {
    const logs = JSON.parse(localStorage.getItem('encoding_fixes_log') || '[]');
    
    if (logs.length === 0) {
      toast.success('✅ Битых текстов не обнаружено!', {
        description: 'Все тексты отображаются корректно'
      });
    } else {
      const recentFixes = logs.slice(-10);
      toast.info(`Найдено ${logs.length} исправлений`, {
        description: `Последнее: "${recentFixes[recentFixes.length - 1]?.originalText}" → "${recentFixes[recentFixes.length - 1]?.fixedText}"`
      });
    }
    
    console.log('📊 Статистика исправлений кодировки:', logs);
  };

  const clearLogs = () => {
    localStorage.removeItem('encoding_fixes_log');
    toast.success('Логи очищены');
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex gap-2">
      <Button
        onClick={testEncoding}
        variant="outline"
        size="sm"
        className="shadow-lg"
      >
        <AlertCircle className="w-4 h-4 mr-2" />
        Проверить кодировку
      </Button>
      <Button
        onClick={clearLogs}
        variant="ghost"
        size="sm"
        className="shadow-lg"
      >
        Очистить логи
      </Button>
    </div>
  );
}
