import { useEffect, useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { toast } from 'sonner';
import { Loader2, Save } from 'lucide-react';
import {
  fetchWholesaleInvoiceCounter,
  updateWholesaleInvoiceCounter,
  type WholesaleInvoiceCounter,
} from '../../lib/api';

/**
 * Виджет для админа: настройка порядкового номера счёта в Точке.
 * Формат итогового номера: `${prefix}${next}` — например, "1-1", "1-2".
 */
export function WholesaleInvoiceCounterSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [counter, setCounter] = useState<WholesaleInvoiceCounter>({ next: 1, prefix: '1-' });
  const [nextInput, setNextInput] = useState('1');
  const [prefixInput, setPrefixInput] = useState('1-');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const c = await fetchWholesaleInvoiceCounter();
        if (!active) return;
        setCounter(c);
        setNextInput(String(c.next));
        setPrefixInput(c.prefix);
      } catch (e) {
        console.error('Failed to load invoice counter', e);
        toast.error('Не удалось загрузить счётчик счетов');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const handleSave = async () => {
    const n = parseInt(nextInput, 10);
    if (!Number.isFinite(n) || n < 1) {
      toast.error('Номер должен быть положительным целым числом');
      return;
    }
    setSaving(true);
    try {
      const updated = await updateWholesaleInvoiceCounter({ next: n, prefix: prefixInput });
      setCounter(updated);
      setNextInput(String(updated.next));
      setPrefixInput(updated.prefix);
      toast.success(`Следующий счёт будет №${updated.prefix}${updated.next}`);
    } catch (e) {
      console.error(e);
      toast.error('Не удалось сохранить настройки');
    } finally {
      setSaving(false);
    }
  };

  const preview = `${prefixInput}${nextInput || '?'}`;
  const isDirty = nextInput !== String(counter.next) || prefixInput !== counter.prefix;

  return (
    <div className="border border-border rounded-lg p-4 mb-6 bg-muted/20">
      <div className="flex flex-col sm:flex-row sm:items-end gap-4">
        <div className="flex-1">
          <p className="text-foreground text-sm mb-1">Нумерация счетов в Точке</p>
          <p className="text-muted-foreground text-xs">
            Следующий счёт будет создан с номером{' '}
            <span className="text-foreground">№{preview}</span>
            {isDirty && <span className="text-amber-500 ml-2">— нажмите «Сохранить»</span>}
          </p>
        </div>
        <div className="flex items-end gap-2">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Префикс</label>
            <Input
              value={prefixInput}
              onChange={(e) => setPrefixInput(e.target.value)}
              placeholder="1-"
              className="w-24"
              disabled={loading || saving}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Следующий №</label>
            <Input
              type="number"
              min={1}
              value={nextInput}
              onChange={(e) => setNextInput(e.target.value)}
              className="w-28"
              disabled={loading || saving}
            />
          </div>
          <Button
            onClick={handleSave}
            disabled={loading || saving || !isDirty}
            className="flex items-center gap-1.5"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Сохранить
          </Button>
        </div>
      </div>
    </div>
  );
}
