import React, { useState, useEffect, useRef } from 'react';
import { X, MapPin, Loader2, Check, Map, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { API_BASE_URL } from '../lib/backendConfig';

interface DaDataSuggestion {
  value: string;
  unrestricted_value: string;
  data: { geo_lat?: string; geo_lon?: string };
}

interface PendingLocation {
  id: number;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  status: 'pending';
  submittedAt: string;
}

interface AddCafeModalProps {
  onClose: () => void;
  onSubmitted: (loc: PendingLocation) => void;
}

declare global {
  interface Window { ymaps: any; }
}

export function AddCafeModal({ onClose, onSubmitted }: AddCafeModalProps) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [selectedCoords, setSelectedCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [suggestions, setSuggestions] = useState<DaDataSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [ymapsLoaded, setYmapsLoaded] = useState(false);
  const [mapInstance, setMapInstance] = useState<any>(null);
  const [placemarkInstance, setPlacemarkInstance] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const suggestionsRef = useRef<HTMLDivElement>(null);
  const addressInputRef = useRef<HTMLInputElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.ymaps) { window.ymaps.ready(() => setYmapsLoaded(true)); return; }
    const script = document.createElement('script');
    script.src = 'https://api-maps.yandex.ru/2.1/?apikey=d273f32f-f343-413c-b1d4-9fc8c0879682&lang=ru_RU';
    script.async = true;
    script.onload = () => window.ymaps.ready(() => setYmapsLoaded(true));
    document.body.appendChild(script);
  }, []);

  useEffect(() => {
    if (!showMap || !ymapsLoaded || !mapContainerRef.current || mapInstance) return;
    const center = selectedCoords ? [selectedCoords.lat, selectedCoords.lon] : [59.9386, 30.3141];
    const map = new window.ymaps.Map(mapContainerRef.current, { center, zoom: 15, controls: ['zoomControl'] });
    const placemark = new window.ymaps.Placemark(center, {}, { preset: 'islands#pinkDotIcon', draggable: true });
    placemark.events.add('dragend', () => {
      const coords = placemark.geometry.getCoordinates();
      setSelectedCoords({ lat: coords[0], lon: coords[1] });
      window.ymaps.geocode(coords).then((res: any) => {
        const geo = res.geoObjects.get(0);
        if (geo) setAddress(geo.getAddressLine());
      });
    });
    map.events.add('click', (e: any) => {
      const coords = e.get('coords');
      placemark.geometry.setCoordinates(coords);
      setSelectedCoords({ lat: coords[0], lon: coords[1] });
      window.ymaps.geocode(coords).then((res: any) => {
        const geo = res.geoObjects.get(0);
        if (geo) setAddress(geo.getAddressLine());
      });
    });
    map.geoObjects.add(placemark);
    setMapInstance(map);
    setPlacemarkInstance(placemark);
    return () => { map.destroy(); setMapInstance(null); setPlacemarkInstance(null); };
  }, [showMap, ymapsLoaded]);

  useEffect(() => {
    if (placemarkInstance && selectedCoords) {
      const c = [selectedCoords.lat, selectedCoords.lon];
      placemarkInstance.geometry.setCoordinates(c);
      if (mapInstance) mapInstance.setCenter(c, 15);
    }
  }, [selectedCoords, placemarkInstance, mapInstance]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node) &&
        addressInputRef.current && !addressInputRef.current.contains(e.target as Node)
      ) setShowSuggestions(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchAddressSuggestions = async (query: string): Promise<DaDataSuggestion[]> => {
    if (query.length < 3) return [];
    try {
      const res = await fetch('https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Token c8937aa9e44939a01f263e984367681de00b8ebb' },
        body: JSON.stringify({ query, locations: [{ city: 'Санкт-Петербург' }], count: 10 }),
      });
      const data = await res.json();
      return data.suggestions || [];
    } catch { return []; }
  };

  const handleAddressChange = async (val: string) => {
    setAddress(val);
    if (val.length < 3) { setSuggestions([]); return; }
    setLoadingSuggestions(true);
    try {
      const results = await fetchAddressSuggestions(val);
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
    } finally { setLoadingSuggestions(false); }
  };

  const handleSuggestionClick = (s: DaDataSuggestion) => {
    setAddress(s.value);
    if (s.data.geo_lat && s.data.geo_lon) {
      setSelectedCoords({ lat: parseFloat(s.data.geo_lat), lon: parseFloat(s.data.geo_lon) });
    }
    setShowSuggestions(false);
  };

  const handleSubmit = async () => {
    if (!name.trim()) { toast.error('Введите название кофейни'); return; }
    if (!address.trim()) { toast.error('Введите адрес'); return; }
    if (!selectedCoords) { toast.error('Выберите адрес из подсказок или отметьте точку на карте'); return; }
    setSaving(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/retail-locations/submit-request`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(), address: address.trim(),
            latitude: selectedCoords.lat, longitude: selectedCoords.lon,
            contactName: contactName.trim() || null,
            contactPhone: contactPhone.trim() || null,
          }),
        }
      );
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      toast.success('✅ Заявка отправлена! Она появится на карте после проверки администратором.');
      onSubmitted(data);
      onClose();
    } catch {
      toast.error('Не удалось отправить заявку. Попробуйте ещё раз.');
    } finally { setSaving(false); }
  };

  const inputCls = "w-full h-12 px-4 rounded-xl border border-[#222222]/12 bg-[#FFF4E5] text-[#222222] text-sm placeholder:text-[#222222]/35 focus:outline-none focus:border-[#FF90A1]/60 transition-colors";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full sm:max-w-lg bg-[#FFF4E5] rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 flex-none">
          <div>
            <h2 className="text-xl font-semibold text-[#222222]">Добавить кофейню</h2>
            <p className="text-sm text-[#222222]/50 mt-0.5">Заявка будет проверена администратором</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#222222]/8 transition-colors"
          >
            <X className="w-4 h-4 text-[#222222]/60" />
          </button>
        </div>

        <div className="w-full h-px bg-[#222222]/8 flex-none" />

        {/* Scrollable form */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

          {/* Name */}
          <div>
            <label className="block text-sm font-semibold text-[#222222] mb-2">Название кофейни *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Например: MNTN Coffee"
              className={inputCls}
            />
          </div>

          {/* Address */}
          <div>
            <label className="block text-sm font-semibold text-[#222222] mb-2">Адрес *</label>
            <div className="relative">
              <input
                ref={addressInputRef}
                type="text"
                value={address}
                onChange={e => handleAddressChange(e.target.value)}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                placeholder="Введите адрес..."
                className={inputCls + (loadingSuggestions ? ' pr-10' : '')}
              />
              {loadingSuggestions && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Loader2 className="w-4 h-4 animate-spin text-[#222222]/30" />
                </div>
              )}

              {showSuggestions && suggestions.length > 0 && (
                <div
                  ref={suggestionsRef}
                  className="absolute z-50 w-full mt-1 bg-[#FFF4E5] border border-[#222222]/10 rounded-xl shadow-lg max-h-52 overflow-auto"
                >
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      onMouseDown={() => handleSuggestionClick(s)}
                      className="w-full text-left px-4 py-3 text-sm text-[#222222] hover:bg-[#FFE5CC] transition-colors border-b border-[#222222]/6 last:border-0"
                    >
                      {s.value}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Coords badge */}
          {selectedCoords && (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-2.5">
              <MapPin className="w-4 h-4 text-green-600 flex-shrink-0" />
              <div>
                <p className="text-xs font-medium text-green-800">Координаты установлены</p>
                <p className="text-xs text-green-600">{selectedCoords.lat.toFixed(5)}, {selectedCoords.lon.toFixed(5)}</p>
              </div>
            </div>
          )}

          {/* Map toggle */}
          <div>
            <button
              type="button"
              onClick={() => setShowMap(v => !v)}
              className="flex items-center gap-2 text-sm text-[#FF90A1] font-medium"
            >
              <Map className="w-4 h-4" />
              Уточнить на карте
              {showMap ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            {showMap && (
              <div className="mt-2 border border-[#222222]/10 rounded-xl overflow-hidden">
                <div ref={mapContainerRef} className="w-full h-[220px] bg-gray-100" />
                <p className="bg-[#FFF4E5] text-xs text-[#222222]/40 px-4 py-2">
                  💡 Кликните на карте или перетащите метку
                </p>
              </div>
            )}
          </div>

          {/* Contact info */}
          <div className="pt-1">
            <div className="w-full h-px bg-[#222222]/8 mb-4" />
            <p className="text-[10px] font-semibold text-[#222222]/40 uppercase tracking-widest mb-4">
              Контактные данные (необязательно)
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-[#222222] mb-2">Ваше имя</label>
                <input
                  type="text"
                  value={contactName}
                  onChange={e => setContactName(e.target.value)}
                  placeholder="Иван Иванов"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#222222] mb-2">Телефон</label>
                <input
                  type="tel"
                  value={contactPhone}
                  onChange={e => setContactPhone(e.target.value)}
                  placeholder="+7 (___) ___-__-__"
                  className={inputCls}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="w-full h-px bg-[#222222]/8 flex-none" />
        <div className="flex gap-3 px-6 py-4 flex-none">
          <button
            onClick={onClose}
            className="flex-1 h-12 rounded-xl border border-[#222222]/15 bg-[#FFF4E5] text-[#222222] text-sm font-medium hover:bg-[#222222]/5 transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !name.trim() || !address.trim() || !selectedCoords}
            className="flex-1 h-12 rounded-xl bg-[#FF90A1] text-white text-sm font-medium flex items-center justify-center gap-2 hover:bg-[#FF7A93] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Отправка...</>
              : <><Check className="w-4 h-4" /> Отправить заявку</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}
