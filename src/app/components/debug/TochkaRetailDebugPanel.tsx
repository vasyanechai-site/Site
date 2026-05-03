import { useCallback, useEffect, useState } from 'react';
import { API_BASE_URL } from '../../lib/backendConfig';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { Loader2, RefreshCw, ExternalLink } from 'lucide-react';

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

type TochkaEnv = {
  hasToken: boolean;
  hasCustomer: boolean;
  hasMerchant: boolean;
  hasTerminal: boolean;
  hasClientId: boolean;
};

function formatJson(obj: unknown) {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
}

export function TochkaRetailDebugPanel({ appendLog }: { appendLog: (line: string) => void }) {
  const [tochkaEnv, setTochkaEnv] = useState<TochkaEnv | null>(null);
  const [tochkaLoading, setTochkaLoading] = useState(false);

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

  const [customerName, setCustomerName] = useState('Тест Оплаты');
  const [customerPhone, setCustomerPhone] = useState('+79991234567');
  const [customerEmail, setCustomerEmail] = useState('debug@coffeenechai.ru');
  const [productPrice, setProductPrice] = useState(150);
  const [productQty, setProductQty] = useState(1);

  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutResult, setCheckoutResult] = useState<Record<string, unknown> | null>(null);

  const loadTochkaEnv = useCallback(async () => {
    setTochkaLoading(true);
    appendLog('GET /api/tochka/acquiring/test-token …');
    try {
      const res = await fetch(`${API_BASE_URL}/tochka/acquiring/test-token`);
      const data = (await res.json()) as TochkaEnv;
      setTochkaEnv(data);
      appendLog(formatJson(data));
    } catch (e) {
      appendLog(`tochka env: ${e instanceof Error ? e.message : String(e)}`);
      setTochkaEnv(null);
    } finally {
      setTochkaLoading(false);
    }
  }, [appendLog]);

  useEffect(() => {
    void loadTochkaEnv();
  }, [loadTochkaEnv]);

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
    setCheckoutResult(null);
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
      appendLog(`ПВЗ: ${(data.pickup_points || []).length}`);
    } catch (e) {
      appendLog(`pvz: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setPvzLoading(false);
    }
  };

  useEffect(() => {
    if (selectedCity.trim() && selectedCityCode !== null) void loadPvz();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const runCheckout = async () => {
    if (!selectedPvz || !calcResult) {
      appendLog('Нужны ПВЗ и успешный расчёт доставки.');
      return;
    }
    const pvzRow = pvz.find((p) => p.code === selectedPvz);
    const orderId = `DEBUG-TOCHKA-${Date.now()}`;
    const body = {
      orderId,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      customerEmail: customerEmail.trim(),
      items: [
        {
          product: {
            id: 'debug-tochka-product',
            name: 'Тест оплаты /debug (розница)',
            category: 'Зерно',
            price: productPrice,
            packageWeight: 500,
            packageLength: 20,
            packageWidth: 15,
            packageHeight: 10,
            imageUrl: '',
          },
          quantity: productQty,
        },
      ],
      deliveryInfo: {
        city: selectedCity,
        pvzCode: selectedPvz,
        pvzAddress: pvzRow?.address || '',
        cost: calcResult.delivery_cost,
        days: calcResult.delivery_days,
        tariffCode: calcResult.tariff_code,
      },
    };

    setCheckoutLoading(true);
    appendLog('POST /api/debug/retail/tochka-checkout …');
    try {
      const res = await fetch(`${API_BASE_URL}/debug/retail/tochka-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        appendLog(`HTTP ${res.status}: ${formatJson(data)}`);
        setCheckoutResult(null);
        return;
      }
      setCheckoutResult(data);
      appendLog(formatJson(data));
      const pay =
        (typeof data.tochkaPaymentUrl === 'string' && data.tochkaPaymentUrl) ||
        (typeof data.tochka_payment_url === 'string' && data.tochka_payment_url) ||
        '';
      if (pay) {
        appendLog('✅ Ссылка на оплату получена. Открываю в новой вкладке…');
        window.open(pay, '_blank', 'noopener,noreferrer');
      } else {
        appendLog('⚠️ Ссылка Точка не пришла — проверьте TOCHKA_* в .env и логи API.');
      }
    } catch (e) {
      appendLog(`checkout: ${e instanceof Error ? e.message : String(e)}`);
      setCheckoutResult(null);
    } finally {
      setCheckoutLoading(false);
    }
  };

  const tochkaReady =
    tochkaEnv &&
    tochkaEnv.hasToken &&
    tochkaEnv.hasCustomer &&
    tochkaEnv.hasMerchant &&
    tochkaEnv.hasTerminal;

  return (
    <div className="space-y-4">
      <Card className="p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-medium">Точка — тест оплаты розницы (после ПВЗ)</h2>
          <Button type="button" size="sm" variant="secondary" onClick={() => void loadTochkaEnv()} disabled={tochkaLoading}>
            {tochkaLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Проверить переменные Точки
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Сценарий как на сайте: <strong>СДЭК</strong> (город → ПВЗ → расчёт) → заказ в БД + запрос{' '}
          <code className="text-xs bg-muted px-1 rounded">payments_with_receipt</code>. Уведомление в Telegram{' '}
          <strong>не</strong> отправляется. Нужны <code className="text-xs">TOCHKA_JWT_TOKEN</code>,{' '}
          <code className="text-xs">TOCHKA_CUSTOMER_CODE</code>, <code className="text-xs">TOCHKA_MERCHANT_ID</code>,{' '}
          <code className="text-xs">TOCHKA_TERMINAL_ID</code> на API.
        </p>
        {tochkaEnv ? (
          <ul className="text-sm font-mono bg-muted/50 rounded-lg p-3 list-none space-y-1">
            <li>JWT: {tochkaEnv.hasToken ? 'да' : 'нет'}</li>
            <li>CUSTOMER: {tochkaEnv.hasCustomer ? 'да' : 'нет'}</li>
            <li>MERCHANT: {tochkaEnv.hasMerchant ? 'да' : 'нет'}</li>
            <li>TERMINAL: {tochkaEnv.hasTerminal ? 'да' : 'нет'}</li>
            <li>CLIENT_ID: {tochkaEnv.hasClientId ? 'да' : 'нет'} (часто нужен для эквайринга)</li>
          </ul>
        ) : null}
        {!tochkaReady ? (
          <p className="text-sm text-amber-900 dark:text-amber-100 bg-amber-50 dark:bg-amber-950/40 rounded-lg p-3">
            Заполните секреты Точки на сервере и перезапустите API — иначе ссылка на оплату не создастся.
          </p>
        ) : null}
      </Card>

      <Card className="p-5 space-y-4">
        <h3 className="font-medium">1. Город → 2. ПВЗ → 3. Расчёт</h3>
        <div className="relative max-w-md">
          <label className="text-xs text-muted-foreground block mb-1">Город</label>
          <Input
            value={cityInput}
            onChange={(e) => setCityInput(e.target.value)}
            onFocus={() => suggestions.length > 0 && setShowSuggest(true)}
            placeholder="Например: Санкт"
          />
          {showSuggest && suggestions.length > 0 ? (
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
          ) : null}
        </div>

        {selectedCity ? (
          <div className="space-y-2">
            <p className="text-sm">
              Город: <strong>{selectedCity}</strong> (код {selectedCityCode})
              {pvzLoading ? <Loader2 className="inline w-4 h-4 animate-spin ml-2" /> : null}
            </p>
            <Button type="button" size="sm" variant="outline" onClick={() => void loadPvz()} disabled={pvzLoading}>
              Обновить ПВЗ
            </Button>
            <div className="max-h-48 overflow-y-auto border rounded-md text-xs">
              {pvz.slice(0, 50).map((p) => (
                <button
                  key={p.code}
                  type="button"
                  onClick={() => {
                    setSelectedPvz(p.code);
                    setCalcResult(null);
                    setCheckoutResult(null);
                  }}
                  className={`w-full text-left px-2 py-1.5 border-b hover:bg-muted ${selectedPvz === p.code ? 'bg-muted font-medium' : ''}`}
                >
                  {p.code} — {p.name}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Сумма товаров для калькулятора (₽)</label>
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
        {calcResult ? <pre className="text-xs bg-muted/50 p-3 rounded-md overflow-x-auto">{formatJson(calcResult)}</pre> : null}
      </Card>

      <Card className="p-5 space-y-4">
        <h3 className="font-medium">4. Покупатель и товар → 5. Оплата Точка</h3>
        <div className="grid gap-3 sm:grid-cols-2 max-w-2xl">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Имя</label>
            <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Телефон</label>
            <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs text-muted-foreground block mb-1">Email</label>
            <Input value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} type="email" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Цена товара (₽)</label>
            <Input type="number" value={productPrice} onChange={(e) => setProductPrice(Number(e.target.value) || 0)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Кол-во</label>
            <Input type="number" min={1} value={productQty} onChange={(e) => setProductQty(Math.max(1, Number(e.target.value) || 1))} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="default"
            className="gap-2"
            onClick={() => void runCheckout()}
            disabled={!selectedPvz || !calcResult || checkoutLoading}
          >
            {checkoutLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
            Создать заказ и открыть оплату
          </Button>
        </div>
        {checkoutResult ? (
          <div className="space-y-2">
            <pre className="text-xs bg-muted/50 p-3 rounded-md overflow-x-auto max-h-64 overflow-y-auto">{formatJson(checkoutResult)}</pre>
            {typeof checkoutResult.tochkaPaymentUrl === 'string' && checkoutResult.tochkaPaymentUrl ? (
              <Button variant="outline" size="sm" asChild>
                <a href={checkoutResult.tochkaPaymentUrl as string} target="_blank" rel="noopener noreferrer">
                  Открыть ссылку оплаты ещё раз
                </a>
              </Button>
            ) : null}
          </div>
        ) : null}
      </Card>
    </div>
  );
}
