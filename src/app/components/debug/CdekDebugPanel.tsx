import { useCallback, useEffect, useRef, useState } from 'react';
import { API_BASE_URL } from '../../lib/backendConfig';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../ui/dialog';
import { Loader2, MapPin, RefreshCw } from 'lucide-react';

declare global {
  interface Window {
    ymaps?: any;
  }
}

const YANDEX_MAPS_KEY =
  import.meta.env.VITE_YANDEX_MAPS_API_KEY || 'd273f32f-f343-413c-b1d4-9fc8c0879682';

type CdekStatus = {
  ok: boolean;
  oauth?: string;
  /** Какой хост API дергает сервер (боевой / тестовый). */
  cdekApiBase?: string;
  hasAccount: boolean;
  hasSecret: boolean;
  accountLength: number;
  secretLength: number;
  accountPrefix?: string;
  error?: string;
  hints?: string[];
};

type CitySuggestion = {
  code: number;
  city: string;
  region: string;
  full_name: string;
  latitude: number;
  longitude: number;
};

type PickupPoint = {
  code: string;
  name: string;
  address: string;
  location: { latitude: number; longitude: number };
  work_time: string;
};

function formatJson(obj: unknown) {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
}

export function CdekDebugPanel({ appendLog }: { appendLog: (line: string) => void }) {
  const [status, setStatus] = useState<CdekStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  /** Прод-API без свежего server/debugRoutes.js — GET /api/debug/cdek/status даёт 404 catch-all. */
  const [debugRouteMissing, setDebugRouteMissing] = useState(false);

  const [cityInput, setCityInput] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedCityCode, setSelectedCityCode] = useState<number | null>(null);
  const [suggestions, setSuggestions] = useState<CitySuggestion[]>([]);
  const [showSuggest, setShowSuggest] = useState(false);

  const [pvz, setPvz] = useState<PickupPoint[]>([]);
  const [pvzLoading, setPvzLoading] = useState(false);
  const [selectedPvz, setSelectedPvz] = useState('');

  const [orderPrice, setOrderPrice] = useState(499);
  const [calcLoading, setCalcLoading] = useState(false);
  const [calcResult, setCalcResult] = useState<{
    delivery_cost: number;
    delivery_days: number;
    tariff_code?: number;
    is_free?: boolean;
  } | null>(null);

  const [orderLoading, setOrderLoading] = useState(false);
  const [orderResult, setOrderResult] = useState<unknown>(null);

  const [mapOpen, setMapOpen] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInst = useRef<any>(null);

  const loadStatus = useCallback(async () => {
    setStatusLoading(true);
    setDebugRouteMissing(false);
    appendLog('GET /api/debug/cdek/status …');
    try {
      const res = await fetch(`${API_BASE_URL}/debug/cdek/status`);
      let data: CdekStatus | Record<string, unknown> = {};
      try {
        data = (await res.json()) as CdekStatus;
      } catch {
        appendLog(`Ответ не JSON (HTTP ${res.status})`);
        setStatus(null);
        return;
      }
      if (
        res.status === 404 &&
        data &&
        typeof data === 'object' &&
        'error' in data &&
        String((data as { error?: string }).error || '').includes('not found')
      ) {
        setDebugRouteMissing(true);
        setStatus(null);
        appendLog(
          'HTTP 404: на API нет маршрута /api/debug/cdek/status — обновите бэкенд на VPS (последний main: server/src/debugRoutes.js) и pm2 restart site-api.',
        );
        return;
      }
      setStatus(data as CdekStatus);
      appendLog(formatJson(data));
    } catch (e) {
      appendLog(`Ошибка: ${e instanceof Error ? e.message : String(e)}`);
      setStatus(null);
    } finally {
      setStatusLoading(false);
    }
  }, [appendLog]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (window.ymaps) {
      window.ymaps.ready(() => setMapLoaded(true));
      return;
    }
    const script = document.createElement('script');
    script.src = `https://api-maps.yandex.ru/2.1/?apikey=${encodeURIComponent(YANDEX_MAPS_KEY)}&lang=ru_RU`;
    script.async = true;
    script.onload = () => window.ymaps?.ready(() => setMapLoaded(true));
    document.body.appendChild(script);
    return () => {
      if (script.parentNode) script.parentNode.removeChild(script);
    };
  }, []);

  useEffect(() => {
    if (cityInput.length < 2 || cityInput === selectedCity) {
      setSuggestions([]);
      setShowSuggest(false);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/cdek/cities?q=${encodeURIComponent(cityInput)}`);
        const data = await res.json();
        if (!res.ok) {
          appendLog(`cities HTTP ${res.status}: ${data.error || formatJson(data)}`);
          setSuggestions([]);
          return;
        }
        setSuggestions(data.cities || []);
        setShowSuggest((data.cities || []).length > 0);
      } catch (e) {
        appendLog(`cities: ${e instanceof Error ? e.message : String(e)}`);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [cityInput, selectedCity, appendLog]);

  const pickCity = (c: CitySuggestion) => {
    setSelectedCity(c.city);
    setSelectedCityCode(c.code);
    setCityInput(c.city);
    setShowSuggest(false);
    setPvz([]);
    setSelectedPvz('');
    setCalcResult(null);
    setOrderResult(null);
  };

  const loadPvz = async () => {
    if (!selectedCity.trim()) return;
    setPvzLoading(true);
    appendLog(`POST /api/cdek/pvz city=${selectedCity} …`);
    try {
      const res = await fetch(`${API_BASE_URL}/cdek/pvz`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city_to: selectedCity, city_code: selectedCityCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        appendLog(`pvz ${res.status}: ${data.error || formatJson(data)}`);
        setPvz([]);
        return;
      }
      setPvz(data.pickup_points || []);
      appendLog(`ПВЗ загружено: ${(data.pickup_points || []).length}`);
    } catch (e) {
      appendLog(`pvz: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setPvzLoading(false);
    }
  };

  useEffect(() => {
    if (selectedCity.trim() && selectedCityCode !== null) void loadPvz();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- только при смене города
  }, [selectedCity, selectedCityCode]);

  const runCalc = async () => {
    if (!selectedPvz) return;
    setCalcLoading(true);
    appendLog('POST /api/cdek/calc …');
    try {
      const res = await fetch(`${API_BASE_URL}/cdek/calc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          city_to: selectedCity,
          city_code: selectedCityCode,
          pvz_code: selectedPvz,
          order_price: orderPrice,
          packages: [{ weight: 500, length: 20, width: 15, height: 10, quantity: 1 }],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        appendLog(`calc ${res.status}: ${data.error || formatJson(data)}`);
        setCalcResult(null);
        return;
      }
      setCalcResult(data);
      appendLog(`calc OK: ${formatJson(data)}`);
    } catch (e) {
      appendLog(`calc: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setCalcLoading(false);
    }
  };

  const runTestOrder = async () => {
    if (!selectedPvz) return;
    if (!confirm('Создать реальный тестовый заказ в ЛК СДЭК? Номер начнётся с DEBUG-.')) return;
    setOrderLoading(true);
    appendLog('POST /api/debug/cdek/test-order …');
    try {
      const res = await fetch(`${API_BASE_URL}/debug/cdek/test-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pvzCode: selectedPvz,
          tariffCode: calcResult?.tariff_code,
        }),
      });
      const data = await res.json();
      setOrderResult(data);
      appendLog(formatJson(data));
    } catch (e) {
      appendLog(`test-order: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setOrderLoading(false);
    }
  };

  const initMap = useCallback(() => {
    if (!mapOpen || !mapLoaded || !window.ymaps || !mapRef.current || pvz.length === 0) return;
    if (mapInst.current) {
      mapInst.current.destroy();
      mapInst.current = null;
    }
    const first = pvz.find((p) => Number(p.location?.latitude) && Number(p.location?.longitude));
    const center: [number, number] = first
      ? [Number(first.location.latitude), Number(first.location.longitude)]
      : [55.751574, 37.573856];
    const map = new window.ymaps.Map(mapRef.current, {
      center,
      zoom: 11,
      controls: ['zoomControl'],
    });
    mapInst.current = map;
    pvz.forEach((p) => {
      const la = Number(p.location?.latitude);
      const lo = Number(p.location?.longitude);
      if (!la || !lo) return;
      const pm = new window.ymaps.Placemark(
        [la, lo],
        {
          balloonContentHeader: p.name,
          balloonContentBody: `${p.address}<br/><small>${p.code}</small>`,
        },
        { preset: selectedPvz === p.code ? 'islands#blackDotIcon' : 'islands#blueCircleDotIcon' },
      );
      pm.events.add('click', () => setSelectedPvz(p.code));
      map.geoObjects.add(pm);
    });
  }, [mapOpen, mapLoaded, pvz, selectedPvz]);

  useEffect(() => {
    if (!mapOpen) {
      if (mapInst.current) {
        mapInst.current.destroy();
        mapInst.current = null;
      }
      return;
    }
    const id = setTimeout(initMap, 200);
    return () => clearTimeout(id);
  }, [mapOpen, initMap]);

  return (
    <div className="space-y-4">
      {debugRouteMissing ? (
        <Card className="p-5 border-amber-500/50 bg-amber-50 dark:bg-amber-950/30 space-y-2">
          <h2 className="text-lg font-medium text-amber-950 dark:text-amber-100">СДЭК на API ещё не подключён (старая версия сервера)</h2>
          <p className="text-sm text-amber-900 dark:text-amber-200 leading-relaxed">
            Запрос к <code className="text-xs bg-background/80 px-1 rounded">{API_BASE_URL}/debug/cdek/status</code> вернул{' '}
            <strong>404</strong> — на VPS запущен Node без маршрутов СДЭК в <code className="text-xs">debugRoutes.js</code>, хотя
            остальной API уже работает. Нужно задеплоить актуальный <code className="text-xs">server/</code> с репозитория (push в{' '}
            <code className="text-xs">main</code> → workflow Deploy to Reg VPS, либо вручную: <code className="text-xs">git pull</code> и{' '}
            <code className="text-xs">pm2 restart site-api --update-env</code>).
          </p>
        </Card>
      ) : null}
      <Card className="p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-medium">СДЭК (OAuth, города, ПВЗ, расчёт, тест-заказ)</h2>
          <Button type="button" size="sm" variant="secondary" onClick={() => void loadStatus()} disabled={statusLoading}>
            {statusLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Проверить OAuth
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          <strong>401 / «No such account secure»</strong> — часто <strong>тестовые ключи</strong> при запросе к <strong>боевому</strong> API (или наоборот). На VPS в <code className="text-xs bg-muted px-1 rounded">.env</code>: для теста задайте{' '}
          <code className="text-xs">CDEK_API_URL=https://api.edu.cdek.ru/v2</code> или <code className="text-xs">CDEK_USE_TEST_API=1</code>; для боя оставьте по умолчанию (<code className="text-xs">https://api.cdek.ru/v2</code>). Плюс: Account и Secure password из раздела интеграции API, не логин ЛК. После правки —{' '}
          <code className="text-xs">pm2 restart site-api --update-env</code>.
        </p>
        {status && (
          <ul className="text-sm font-mono bg-muted/50 rounded-lg p-3 list-none space-y-1">
            {status.cdekApiBase ? <li>API host: {status.cdekApiBase}</li> : null}
            <li>OAuth: {status.oauth}</li>
            <li>ok: {String(status.ok)}</li>
            <li>CDEK_ACCOUNT: {status.hasAccount ? `да, длина ${status.accountLength}` : 'нет'}</li>
            <li>CDEK_SECRET: {status.hasSecret ? `да, длина ${status.secretLength}` : 'нет'}</li>
            {status.accountPrefix ? <li>префикс идентификатора: {status.accountPrefix}</li> : null}
            {status.error ? <li className="text-red-600 break-words">ошибка: {status.error}</li> : null}
          </ul>
        )}
        {status?.hints?.map((h) => (
          <p key={h} className="text-sm text-amber-900 dark:text-amber-100 bg-amber-50 dark:bg-amber-950/40 rounded-lg p-3">
            {h}
          </p>
        ))}
      </Card>

      <Card className="p-5 space-y-4">
        <h3 className="font-medium">1. Город → 2. ПВЗ → 3. Расчёт → 4. Тест-заказ</h3>
        <div className="relative max-w-md">
          <label className="text-xs text-muted-foreground block mb-1">Город (как в корзине)</label>
          <Input
            value={cityInput}
            onChange={(e) => setCityInput(e.target.value)}
            onFocus={() => suggestions.length && setShowSuggest(true)}
            placeholder="Например: Санкт"
          />
          {showSuggest && suggestions.length > 0 && (
            <div className="absolute z-20 w-full mt-1 border rounded-md bg-background shadow max-h-56 overflow-y-auto">
              {suggestions.map((s) => (
                <button
                  key={s.code}
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm hover:bg-muted border-b last:border-0"
                  onClick={() => pickCity(s)}
                >
                  <div className="font-medium">{s.city}</div>
                  <div className="text-xs text-muted-foreground">{s.full_name}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {selectedCity ? (
          <div className="space-y-2">
            <p className="text-sm">
              Выбран: <strong>{selectedCity}</strong> (код {selectedCityCode})
              {pvzLoading ? <Loader2 className="inline w-4 h-4 animate-spin ml-2" /> : null}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => void loadPvz()} disabled={pvzLoading}>
                Обновить ПВЗ
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setMapOpen(true)} disabled={pvz.length === 0}>
                <MapPin className="w-4 h-4 mr-1" />
                Карта ПВЗ
              </Button>
            </div>
            <div className="max-h-48 overflow-y-auto border rounded-md text-xs">
              {pvz.slice(0, 40).map((p) => (
                <button
                  key={p.code}
                  type="button"
                  onClick={() => {
                    setSelectedPvz(p.code);
                    setCalcResult(null);
                  }}
                  className={`w-full text-left px-2 py-1.5 border-b hover:bg-muted ${selectedPvz === p.code ? 'bg-muted font-medium' : ''}`}
                >
                  {p.code} — {p.name}
                </button>
              ))}
            </div>
            {pvz.length > 40 ? <p className="text-xs text-muted-foreground">Показаны первые 40; на карте — все с координатами.</p> : null}
          </div>
        ) : null}

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Сумма заказа (₽) для калькулятора</label>
            <Input
              type="number"
              className="w-32"
              value={orderPrice}
              onChange={(e) => setOrderPrice(Number(e.target.value) || 0)}
            />
          </div>
          <Button type="button" onClick={() => void runCalc()} disabled={!selectedPvz || calcLoading}>
            {calcLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Расчёт доставки
          </Button>
        </div>
        {calcResult ? (
          <pre className="text-xs bg-muted/50 p-3 rounded-md overflow-x-auto">{formatJson(calcResult)}</pre>
        ) : null}

        <Button type="button" variant="destructive" onClick={() => void runTestOrder()} disabled={!selectedPvz || orderLoading}>
          {orderLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Создать тестовый заказ в ЛК СДЭК
        </Button>
        {orderResult ? <pre className="text-xs bg-muted/50 p-3 rounded-md overflow-x-auto">{formatJson(orderResult)}</pre> : null}
      </Card>

      <Dialog open={mapOpen} onOpenChange={setMapOpen}>
        <DialogContent className="max-w-3xl w-[95vw]">
          <DialogHeader>
            <DialogTitle>ПВЗ на карте</DialogTitle>
            <DialogDescription>Клик по метке — выбор кода ПВЗ. Закройте окно и нажмите «Расчёт доставки».</DialogDescription>
          </DialogHeader>
          <div ref={mapRef} className="w-full h-[420px] rounded-md border bg-muted/30" />
        </DialogContent>
      </Dialog>
    </div>
  );
}
