import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { toast } from 'sonner';
import { Loader2, Save } from 'lucide-react';
import { API_BASE_URL } from '../lib/backendConfig';

interface TickerSettings {
  enabled: boolean;
  text: string;
}

interface TickerManagementProps {
  variant?: 'wholesale' | 'retail';
}

export function TickerManagement({ variant = 'wholesale' }: TickerManagementProps) {
  const [settings, setSettings] = useState<TickerSettings>({ enabled: false, text: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, [variant]);

  const fetchSettings = async () => {
    try {
      console.log(`Fetching ticker settings for ${variant}...`);
      const response = await fetch(`${API_BASE_URL}/ticker-settings?type=${variant}`);
      console.log('Ticker settings response status:', response.status);
      if (response.ok) {
        const data = await response.json();
        console.log('Ticker settings loaded:', data);
        setSettings(data);
      }
    } catch (error) {
      console.error('Failed to fetch ticker settings:', error);
      toast.error('Не удалось загрузить настройки бегущей строки');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      console.log('Saving ticker settings:', settings);
      setSaving(true);
      const response = await fetch(`${API_BASE_URL}/ticker-settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ...settings, type: variant }),
      });

      console.log('Save response status:', response.status);
      if (response.ok) {
        const result = await response.json();
        console.log('Settings saved successfully:', result);
        toast.success('Настройки сохранены');
      } else {
        const errorText = await response.text();
        console.error('Failed to save, response:', errorText);
        throw new Error('Failed to save');
      }
    } catch (error) {
      console.error('Failed to save ticker settings:', error);
      toast.error('Не удалось сохранить настройки');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Бегущая строка</CardTitle>
        <CardDescription>
          Управление информационной строкой в верхней части сайта. Строка будет отображаться под шапкой.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between space-x-2">
          <div className="space-y-0.5">
            <Label className="text-base">Включить бегущую строку</Label>
            <p className="text-sm text-muted-foreground">
              Когда включено, строка будет отображаться под шапкой сайта на всех страницах.
            </p>
          </div>
          <Switch
            checked={settings.enabled}
            onCheckedChange={(checked) => setSettings({ ...settings, enabled: checked })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="ticker-text">Текст строки</Label>
          <Input
            id="ticker-text"
            placeholder="Кофе - это Нечай"
            value={settings.text}
            onChange={(e) => setSettings({ ...settings, text: e.target.value })}
          />
          <p className="text-sm text-muted-foreground">
            Этот текст будет медленно прокручиваться справа налево с бесконечным повтором.
          </p>
        </div>

        {settings.enabled && settings.text && (
          <div className="mt-6 p-4 border border-border rounded-lg bg-muted/50">
            <Label className="text-sm text-muted-foreground mb-2 block">Предпросмотр:</Label>
            <div className="h-[32px] sm:h-[50px] bg-[#9aaed9] overflow-hidden flex items-center rounded relative">
              <div className="whitespace-nowrap animate-scroll-slow absolute">
                <div className="inline-flex items-center">
                  {Array(10).fill(settings.text).map((text, i) => (
                    <span key={i} className="text-white dark:text-gray-900 text-sm sm:text-lg font-normal mr-[32px] sm:mr-[48px]">
                      {text}
                    </span>
                  ))}
                </div>
                <div className="inline-flex items-center">
                  {Array(10).fill(settings.text).map((text, i) => (
                    <span key={`dup-${i}`} className="text-white dark:text-gray-900 text-sm sm:text-lg font-normal mr-[32px] sm:mr-[48px]">
                      {text}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Текст будет медленно прокручиваться справа налево с бесконечным повтором.
            </p>
          </div>
        )}

        <div className="pt-4">
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {!saving && <Save className="mr-2 h-4 w-4" />}
            Сохранить изменения
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}