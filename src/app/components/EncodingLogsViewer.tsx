import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { RefreshCw, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';
import { FadeIn } from './ui/fade-in';

interface EncodingLogEntry {
  timestamp: Date;
  originalText: string;
  fixedText: string;
  element: string;
}

/**
 * Компонент для просмотра логов исправленных битых текстов
 * Используется в админке для отладки проблем с кодировкой
 */
export function EncodingLogsViewer() {
  const [logs, setLogs] = useState<EncodingLogEntry[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const loadLogs = () => {
    // Получаем логи из localStorage или памяти
    try {
      const stored = localStorage.getItem('encoding_fixes_log');
      if (stored) {
        const parsed = JSON.parse(stored);
        setLogs(parsed.map((entry: any) => ({
          ...entry,
          timestamp: new Date(entry.timestamp)
        })));
      }
    } catch (error) {
      console.error('Failed to load encoding logs:', error);
    }
  };

  const clearLogs = () => {
    localStorage.removeItem('encoding_fixes_log');
    setLogs([]);
  };

  useEffect(() => {
    loadLogs();

    if (!autoRefresh) return;

    const interval = setInterval(loadLogs, 2000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const stats = {
    total: logs.length,
    unique: new Set(logs.map(l => l.originalText)).size,
    recentCount: logs.filter(l => 
      new Date().getTime() - l.timestamp.getTime() < 60000
    ).length
  };

  return (
    <div className="space-y-4">
      <FadeIn>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-yellow-500" />
                  Логи исправления кодировки
                </CardTitle>
                <CardDescription>
                  Мониторинг и исправление битых текстов на сайте
                </CardDescription>
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  variant={autoRefresh ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAutoRefresh(!autoRefresh)}
                >
                  {autoRefresh && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  )}
                  {autoRefresh ? 'Авто-обновление' : 'Вкл. авто-обновление'}
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadLogs}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Обновить
                </Button>
                
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={clearLogs}
                  disabled={logs.length === 0}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Очистить
                </Button>
              </div>
            </div>
          </CardHeader>
          
          <CardContent>
            {/* Статистика */}
            <div className="grid grid-cols-3 gap-4 mb-6 p-4 bg-muted/30 rounded-lg">
              <div className="text-center">
                <div className="text-2xl font-bold text-foreground">{stats.total}</div>
                <div className="text-xs text-muted-foreground">Всего исправлений</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-foreground">{stats.unique}</div>
                <div className="text-xs text-muted-foreground">Уникальных текстов</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{stats.recentCount}</div>
                <div className="text-xs text-muted-foreground">За последнюю минуту</div>
              </div>
            </div>

            {/* Таблица логов */}
            {logs.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-green-500" />
                <p className="font-medium">Битых текстов не обнаружено</p>
                <p className="text-sm mt-2">Все тексты корректно отображаются</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border">
                    <tr>
                      <th className="text-left py-3 px-4">Время</th>
                      <th className="text-left py-3 px-4">Битый текст</th>
                      <th className="text-left py-3 px-4">Исправленный текст</th>
                      <th className="text-left py-3 px-4">Статус</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.slice().reverse().map((log, idx) => (
                      <tr key={idx} className="border-b border-border/50 hover:bg-muted/20">
                        <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">
                          {log.timestamp.toLocaleTimeString('ru-RU', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit'
                          })}
                        </td>
                        <td className="py-3 px-4">
                          <code className="bg-red-500/10 text-red-600 dark:text-red-400 px-2 py-1 rounded text-xs font-mono">
                            {log.originalText}
                          </code>
                        </td>
                        <td className="py-3 px-4">
                          <code className="bg-green-500/10 text-green-600 dark:text-green-400 px-2 py-1 rounded text-xs font-mono">
                            {log.fixedText}
                          </code>
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant="outline" className="text-xs border-green-500/50 text-green-600">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Исправлено
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </FadeIn>

      {/* Инструкции */}
      <FadeIn delay={0.1}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Как это работает?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              <strong>EncodingValidator</strong> автоматически сканирует все страницы и модальные окна 
              на наличие битых текстов (символы �).
            </p>
            <p>
              При обнаружении битого текста система автоматически исправляет его на правильный 
              и записывает в этот лог для отладки.
            </p>
            <p>
              Если вы видите новые битые тексты:
            </p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>Скопируйте битую и исправленную версии из лога</li>
              <li>Добавьте новую замену в <code className="bg-muted px-1 rounded">ENCODING_FIXES</code> в <code className="bg-muted px-1 rounded">EncodingValidator.tsx</code></li>
              <li>Проверьте исходный файл - возможно проблема в кодировке файла</li>
            </ol>
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  );
}
