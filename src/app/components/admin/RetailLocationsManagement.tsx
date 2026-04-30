import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Loader2, Plus, Pencil, Trash2, MapPin, Check, X, Building2, Home, Map, RefreshCw, Clock, CheckCircle2, XCircle, Phone, User } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

interface Location {
  id: number;
  name: string;
  address: string;
  latitude?: number | null;
  longitude?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

interface LocationRequest {
  id: number;
  name: string;
  address: string;
  latitude?: number | null;
  longitude?: number | null;
  contactName?: string | null;
  contactPhone?: string | null;
  status: 'pending';
  submittedAt: string;
}

interface DaDataSuggestion {
  value: string;
  unrestricted_value: string;
  data: { geo_lat?: string; geo_lon?: string };
}

interface YandexOrgSuggestion {
  name: string;
  address: string;
  coordinates: [number, number];
  type: 'organization';
}

type Suggestion = DaDataSuggestion | YandexOrgSuggestion;

declare global {
  interface Window { ymaps: any; }
}

export function RetailLocationsManagement() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [locationRequests, setLocationRequests] = useState<LocationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [addingNew, setAddingNew] = useState(false);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [approvingId, setApprovingId] = useState<number | null>(null);
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [ymapsLoaded, setYmapsLoaded] = useState(false);
  const [searchMode, setSearchMode] = useState<'address' | 'organization'>('organization');
  const [selectedCoords, setSelectedCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [mapInstance, setMapInstance] = useState<any>(null);
  const [placemarkInstance, setPlacemarkInstance] = useState<any>(null);

  const suggestionsRef = useRef<HTMLDivElement>(null);
  const addressInputRef = useRef<HTMLInputElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // Load Yandex Maps API
  useEffect(() => {
    if (window.ymaps) { window.ymaps.ready(() => setYmapsLoaded(true)); return; }
    const script = document.createElement('script');
    script.src = 'https://api-maps.yandex.ru/2.1/?apikey=d273f32f-f343-413c-b1d4-9fc8c0879682&lang=ru_RU';
    script.async = true;
    script.onload = () => window.ymaps.ready(() => setYmapsLoaded(true));
    document.body.appendChild(script);
  }, []);

  // Initialize map when showing
  useEffect(() => {
    if (!showMap || !ymapsLoaded || !mapContainerRef.current || mapInstance) return;
    const defaultCenter = selectedCoords ? [selectedCoords.lat, selectedCoords.lon] : [59.9386, 30.3141];
    const map = new window.ymaps.Map(mapContainerRef.current, { center: defaultCenter, zoom: 15, controls: ['zoomControl', 'searchControl'] });
    const placemark = new window.ymaps.Placemark(defaultCenter, { balloonContent: 'Перетащите метку в нужное место' }, { preset: 'islands#redDotIcon', draggable: true });
    placemark.events.add('dragend', () => {
      const coords = placemark.geometry.getCoordinates();
      setSelectedCoords({ lat: coords[0], lon: coords[1] });
      window.ymaps.geocode(coords).then((res: any) => {
        const geo = res.geoObjects.get(0);
        if (geo) setAddress(geo.getAddressLine());
      });
    });
    map.geoObjects.add(placemark);
    map.events.add('click', (e: any) => {
      const coords = e.get('coords');
      placemark.geometry.setCoordinates(coords);
      setSelectedCoords({ lat: coords[0], lon: coords[1] });
      window.ymaps.geocode(coords).then((res: any) => {
        const geo = res.geoObjects.get(0);
        if (geo) setAddress(geo.getAddressLine());
      });
    });
    setMapInstance(map);
    setPlacemarkInstance(placemark);
    return () => { if (map) { map.destroy(); setMapInstance(null); setPlacemarkInstance(null); } };
  }, [showMap, ymapsLoaded]);

  useEffect(() => {
    if (placemarkInstance && selectedCoords) {
      const coords = [selectedCoords.lat, selectedCoords.lon];
      placemarkInstance.geometry.setCoordinates(coords);
      if (mapInstance) mapInstance.setCenter(coords, 15);
    }
  }, [selectedCoords, placemarkInstance, mapInstance]);

  useEffect(() => { loadLocations(); loadLocationRequests(); }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node) &&
        addressInputRef.current && !addressInputRef.current.contains(event.target as Node)
      ) setShowSuggestions(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadLocations = async () => {
    setLoading(true);
    try {
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-aa167a09/retail-locations`, { headers: { 'Authorization': `Bearer ${publicAnonKey}` } });
      if (!res.ok) throw new Error('Failed to load locations');
      setLocations(await res.json());
    } catch (e) {
      console.error('Error loading locations:', e);
      toast.error('Не удалось загрузить точки продаж');
    } finally { setLoading(false); }
  };

  const loadLocationRequests = async () => {
    setLoadingRequests(true);
    try {
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-aa167a09/retail-locations/requests`, { headers: { 'Authorization': `Bearer ${publicAnonKey}` } });
      if (!res.ok) throw new Error('Failed to load requests');
      setLocationRequests(await res.json());
    } catch (e) {
      console.error('Error loading location requests:', e);
    } finally { setLoadingRequests(false); }
  };

  const fetchOrganizationSuggestions = async (query: string): Promise<YandexOrgSuggestion[]> => {
    if (!ymapsLoaded || !query || query.length < 3) return [];
    return new Promise((resolve) => {
      window.ymaps.suggest(`Санкт-Петербург, ${query}`, { results: 10, boundedBy: [[59.7, 30.1], [60.1, 30.6]] })
        .then((items: any[]) => resolve(
          items.filter(i => i.type === 'biz' || i.displayName.includes('организация')).map(i => {
            const parts = i.displayName.split(',');
            return { name: parts[0]?.trim() || '', address: parts.slice(1).join(',').trim() || i.displayName, coordinates: i.center || [0, 0], type: 'organization' as const };
          })
        )).catch(() => resolve([]));
    });
  };

  const fetchAddressSuggestions = async (query: string): Promise<DaDataSuggestion[]> => {
    if (!query || query.length < 3) return [];
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

  const handleAddressChange = async (value: string) => {
    setAddress(value);
    if (!value || value.length < 3) { setSuggestions([]); return; }
    setLoadingSuggestions(true);
    try {
      let all: Suggestion[] = [];
      if (searchMode === 'organization') {
        const orgs = await fetchOrganizationSuggestions(value);
        all = orgs;
        if (orgs.length < 5) all = [...orgs, ...await fetchAddressSuggestions(value)];
      } else {
        all = await fetchAddressSuggestions(value);
      }
      setSuggestions(all);
      setShowSuggestions(true);
    } finally { setLoadingSuggestions(false); }
  };

  const handleSuggestionClick = (s: Suggestion) => {
    if ('type' in s && s.type === 'organization') {
      setName(s.name); setAddress(s.address);
      setSelectedCoords({ lat: s.coordinates[0], lon: s.coordinates[1] });
      toast.success('📍 Координаты организации установлены');
    } else {
      const d = s as DaDataSuggestion;
      setAddress(d.value);
      if (d.data.geo_lat && d.data.geo_lon) {
        setSelectedCoords({ lat: parseFloat(d.data.geo_lat), lon: parseFloat(d.data.geo_lon) });
        toast.success('📍 Координаты адреса установлены');
      }
    }
    setShowSuggestions(false);
  };

  const handleAdd = async () => {
    if (!name.trim() || !address.trim()) { toast.error('Заполните название и адрес'); return; }
    if (!selectedCoords) { toast.error('Установите точку на карте или выберите адрес из подсказок'); return; }
    setSaving(true);
    try {
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-aa167a09/retail-locations`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, address, latitude: selectedCoords.lat, longitude: selectedCoords.lon }),
      });
      if (!res.ok) throw new Error('Failed to add location');
      toast.success('✅ Точка продаж добавлена');
      setName(''); setAddress(''); setSelectedCoords(null); setAddingNew(false); setShowMap(false);
      await loadLocations();
    } catch (e) { console.error(e); toast.error('Не удалось добавить точку продаж'); }
    finally { setSaving(false); }
  };

  const handleUpdate = async (id: number) => {
    if (!name.trim() || !address.trim()) { toast.error('Заполните название и адрес'); return; }
    if (!selectedCoords) { toast.error('Установите точку на карте или выберите адрес из подсказок'); return; }
    setSaving(true);
    try {
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-aa167a09/retail-locations/${id}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, address, latitude: selectedCoords.lat, longitude: selectedCoords.lon }),
      });
      if (!res.ok) throw new Error('Failed to update location');
      toast.success('✅ Точка продаж обновлена');
      setEditingId(null); setName(''); setAddress(''); setSelectedCoords(null); setShowMap(false);
      await loadLocations();
    } catch (e) { console.error(e); toast.error('Не удалось обновить точку продаж'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Вы уверены, что хотите удалить эту точку продаж?')) return;
    try {
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-aa167a09/retail-locations/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${publicAnonKey}` } });
      if (!res.ok) throw new Error('Failed to delete location');
      toast.success('Точка продаж удалена');
      await loadLocations();
    } catch (e) { console.error(e); toast.error('Не удалось удалить точку продаж'); }
  };

  const handleApproveRequest = async (id: number) => {
    if (!confirm('Одобрить этот запрос и добавить кофейню на карту?')) return;
    setApprovingId(id);
    try {
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-aa167a09/retail-locations/requests/${id}/approve`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${publicAnonKey}` },
      });
      if (!res.ok) throw new Error('Failed to approve');
      toast.success('✅ Кофейня одобрена и добавлена на карту');
      await Promise.all([loadLocationRequests(), loadLocations()]);
    } catch (e) { console.error(e); toast.error('Не удалось одобрить запрос'); }
    finally { setApprovingId(null); }
  };

  const handleRejectRequest = async (id: number) => {
    if (!confirm('Отклонить этот запрос?')) return;
    setRejectingId(id);
    try {
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-aa167a09/retail-locations/requests/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${publicAnonKey}` },
      });
      if (!res.ok) throw new Error('Failed to reject');
      toast.success('Запрос отклонён');
      await loadLocationRequests();
    } catch (e) { console.error(e); toast.error('Не удалось отклонить запрос'); }
    finally { setRejectingId(null); }
  };

  const startEdit = (location: Location) => {
    setEditingId(location.id); setName(location.name); setAddress(location.address); setAddingNew(false);
    if (location.latitude && location.longitude) setSelectedCoords({ lat: location.latitude, lon: location.longitude });
    else setSelectedCoords(null);
    setShowMap(true);
  };

  const cancelEdit = () => { setEditingId(null); setAddingNew(false); setName(''); setAddress(''); setSelectedCoords(null); setSuggestions([]); setShowSuggestions(false); setShowMap(false); };
  const startAdd = () => { setAddingNew(true); setEditingId(null); setName(''); setAddress(''); setSelectedCoords(null); setShowMap(true); };

  const handleInitialize = async () => {
    if (!confirm('Инициализировать базу данных начальными точками продаж с автоматическим геокодированием?')) return;
    setInitializing(true);
    try {
      toast.info('🌍 Геокодирование адресов... Пожалуйста, подождите');
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-aa167a09/retail-locations/init`, { method: 'POST', headers: { 'Authorization': `Bearer ${publicAnonKey}` } });
      if (!res.ok) throw new Error('Failed to initialize');
      const data = await res.json();
      toast.success(data.geocoded !== undefined ? `✅ ${data.message}\n📍 Геокодировано: ${data.geocoded} из ${data.count}` : data.message);
      await loadLocations();
    } catch (e) { toast.error('Не удалось инициализировать точки продаж'); }
    finally { setInitializing(false); }
  };

  const handleReinitialize = async () => {
    if (!confirm('🔄 Переинициализировать все точки продаж?\n\nЭто удалит текущие точки и создаст их заново с координатами.')) return;
    setInitializing(true);
    try {
      toast.info('🗑️ Очистка старых данных...');
      await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-aa167a09/retail-locations`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${publicAnonKey}` } });
      toast.info('🌍 Геокодирование адресов... Пожалуйста, подождите');
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-aa167a09/retail-locations/init`, { method: 'POST', headers: { 'Authorization': `Bearer ${publicAnonKey}` } });
      if (!res.ok) throw new Error('Failed to initialize');
      const data = await res.json();
      toast.success(data.geocoded !== undefined ? `✅ ${data.message}\n📍 Геокодировано: ${data.geocoded} из ${data.count}` : data.message);
      await loadLocations();
    } catch (e) { toast.error('Не удалось переинициализировать точки продаж'); }
    finally { setInitializing(false); }
  };

  const renderFormFields = (isEdit: boolean, locationId?: number) => (
    <div className="space-y-4">
      <div>
        <Label htmlFor={isEdit ? `edit-name-${locationId}` : 'new-name'}>Название кофейни</Label>
        <Input id={isEdit ? `edit-name-${locationId}` : 'new-name'} value={name} onChange={e => setName(e.target.value)} placeholder="Например: MNTN Coffee" className="mt-1.5" />
      </div>

      <div className="flex gap-2 bg-[#FFF9F0] p-2 rounded-lg">
        <Button type="button" variant={searchMode === 'organization' ? 'default' : 'outline'} size="sm" onClick={() => setSearchMode('organization')} className="flex-1">
          <Building2 className="w-4 h-4 mr-2" />По организации
        </Button>
        <Button type="button" variant={searchMode === 'address' ? 'default' : 'outline'} size="sm" onClick={() => setSearchMode('address')} className="flex-1">
          <Home className="w-4 h-4 mr-2" />По адресу
        </Button>
      </div>

      <div className="relative">
        <Label htmlFor={isEdit ? `edit-address-${locationId}` : 'new-address'}>Адрес</Label>
        <div className="relative">
          <Input
            id={isEdit ? `edit-address-${locationId}` : 'new-address'}
            ref={addressInputRef}
            value={address}
            onChange={e => handleAddressChange(e.target.value)}
            placeholder={searchMode === 'organization' ? 'Введите название организации...' : 'Введите адрес...'}
            className="mt-1.5 pr-10"
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          />
          {loadingSuggestions && <div className="absolute right-3 top-1/2 -translate-y-1/2"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>}
        </div>
        {showSuggestions && suggestions.length > 0 && (
          <div ref={suggestionsRef} className="absolute z-50 w-full mt-1 bg-[#FFF4E5] border border-border rounded-md shadow-lg max-h-80 overflow-auto">
            {suggestions.map((s, i) => {
              const isOrg = 'type' in s && s.type === 'organization';
              return (
                <button key={i} onClick={() => handleSuggestionClick(s)} className="w-full text-left px-4 py-3 hover:bg-[#FFE5CC] transition-colors border-b border-[#FFE5CC] last:border-0">
                  <div className="flex items-start gap-2">
                    {isOrg ? <Building2 className="w-4 h-4 mt-0.5 text-[#E8A0BF] flex-shrink-0" /> : <Home className="w-4 h-4 mt-0.5 text-[#E8A0BF] flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      {isOrg ? (
                        <><div className="font-medium text-sm">{(s as YandexOrgSuggestion).name}</div><div className="text-xs text-muted-foreground mt-0.5 truncate">{(s as YandexOrgSuggestion).address}</div></>
                      ) : (
                        <div className="text-sm">{(s as DaDataSuggestion).value}</div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {selectedCoords && (
        <div className="bg-[#E8F5E9] p-3 rounded-lg">
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 mt-0.5 text-green-600" />
            <div className="flex-1">
              <div className="text-sm font-medium text-green-800">Координаты установлены</div>
              <div className="text-xs text-green-600 mt-0.5">Широта: {selectedCoords.lat.toFixed(6)}, Долгота: {selectedCoords.lon.toFixed(6)}</div>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-2"><Map className="w-4 h-4" />Точное расположение на карте</Label>
          <Button type="button" variant="outline" size="sm" onClick={() => setShowMap(!showMap)}>{showMap ? 'Скрыть карту' : 'Показать карту'}</Button>
        </div>
        {showMap && (
          <div className="border-2 border-[#E8A0BF] rounded-lg overflow-hidden">
            <div ref={mapContainerRef} className="w-full h-[400px] bg-gray-100" />
            <div className="bg-[#FFF9F0] p-3 text-sm text-muted-foreground">💡 <strong>Как установить точку:</strong> Кликните на карте или перетащите метку в нужное место</div>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Button onClick={isEdit ? () => handleUpdate(locationId!) : handleAdd} disabled={saving || !selectedCoords}>
          {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Сохранение...</> : <><Check className="w-4 h-4 mr-2" />Сохранить</>}
        </Button>
        <Button onClick={cancelEdit} variant="outline" disabled={saving}><X className="w-4 h-4 mr-2" />Отмена</Button>
      </div>
    </div>
  );

  if (loading) {
    return <div className="flex items-center justify-center p-8"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* ─── Заявки на добавление ─── */}
      {(locationRequests.length > 0 || loadingRequests) && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-amber-800">
              <Clock className="w-5 h-5" />
              Заявки на добавление кофейни
              {locationRequests.length > 0 && (
                <span className="ml-auto inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-500 text-white text-xs font-bold">
                  {locationRequests.length}
                </span>
              )}
            </CardTitle>
            <CardDescription className="text-amber-700">
              Пользователи предлагают добавить эти кофейни на карту. Одобрите или отклоните каждую заявку.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingRequests ? (
              <div className="flex items-center justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-amber-600" /></div>
            ) : (
              <div className="space-y-3">
                {locationRequests.map(req => (
                  <div key={req.id} className="bg-white rounded-xl border border-amber-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-[#222222]">{req.name}</h3>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 border border-amber-200 text-amber-700 text-[10px] font-medium flex-shrink-0">
                            <Clock className="w-2.5 h-2.5" />
                            Ждёт одобрения
                          </span>
                        </div>
                        <p className="text-sm text-[#222222]/70 mb-2">{req.address}</p>
                        {req.latitude && req.longitude && (
                          <p className="text-xs text-amber-700 mb-2">📍 {req.latitude.toFixed(5)}, {req.longitude.toFixed(5)}</p>
                        )}
                        <div className="flex flex-wrap gap-3 text-xs text-[#222222]/50">
                          {req.contactName && (
                            <span className="flex items-center gap-1"><User className="w-3 h-3" />{req.contactName}</span>
                          )}
                          {req.contactPhone && (
                            <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{req.contactPhone}</span>
                          )}
                          <span>
                            {new Date(req.submittedAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 flex-shrink-0">
                        <Button
                          size="sm"
                          onClick={() => handleApproveRequest(req.id)}
                          disabled={approvingId === req.id || rejectingId === req.id}
                          className="bg-green-600 hover:bg-green-700 text-white gap-1.5"
                        >
                          {approvingId === req.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                          Одобрить
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRejectRequest(req.id)}
                          disabled={approvingId === req.id || rejectingId === req.id}
                          className="text-red-600 border-red-200 hover:bg-red-50 gap-1.5"
                        >
                          {rejectingId === req.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                          Отклонить
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ─── Управление точками продаж ─── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Управление точками продаж
          </CardTitle>
          <CardDescription>
            Добавляйте и редактируйте точки продаж. Используйте интерактивную карту для точного позиционирования.<br />
            💡 Если пины не отображаются на публичной карте, нажмите кнопку «Переинициализировать с координатами»
          </CardDescription>
        </CardHeader>
        <CardContent>
          {addingNew && (
            <Card className="mb-6 bg-[#FFF9F0]">
              <CardContent className="pt-6">{renderFormFields(false)}</CardContent>
            </Card>
          )}

          {!addingNew && !editingId && (
            <div className="flex flex-wrap gap-3 mb-6">
              <Button onClick={startAdd} size="sm">
                <Plus className="w-4 h-4 mr-2" />Добавить точку продаж
              </Button>
              {locations.length === 0 ? (
                <Button onClick={handleInitialize} variant="outline" size="sm" disabled={initializing}>
                  {initializing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Геокодирование адресов...</> : <><MapPin className="w-4 h-4 mr-2" />Инициализировать с координатами</>}
                </Button>
              ) : (
                <Button onClick={handleReinitialize} variant="outline" size="sm" disabled={initializing} className="bg-[#E8A0BF]/10 hover:bg-[#E8A0BF]/20 border-[#E8A0BF]">
                  {initializing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Переинициализация...</> : <><RefreshCw className="w-4 h-4 mr-2" />Переинициализировать с координатами</>}
                </Button>
              )}
            </div>
          )}

          {locations.length > 0 && locations.some(l => !l.latitude || !l.longitude) && (
            <div className="mb-6 p-4 bg-yellow-50 border-2 border-yellow-300 rounded-lg">
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-yellow-900">⚠️ Некоторые точки продаж не имеют координат</p>
                  <p className="text-xs text-yellow-700 mt-1">Пины на публичной карте «Где купить» не будут отображаться. Нажмите «Переинициализировать с координатами» выше.</p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {locations.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">Пока нет точек продаж. Добавьте первую!</p>
            ) : (
              locations.map(location => (
                <Card key={location.id}>
                  <CardContent className="pt-6">
                    {editingId === location.id ? renderFormFields(true, location.id) : (
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium text-lg">{location.name}</h3>
                            {location.latitude && location.longitude ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full"><MapPin className="w-3 h-3" />GPS</span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full"><X className="w-3 h-3" />Нет координат</span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{location.address}</p>
                          {location.latitude && location.longitude && (
                            <p className="text-xs text-[#E8A0BF] mt-1.5">📍 {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}</p>
                          )}
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <Button onClick={() => startEdit(location)} variant="outline" size="sm"><Pencil className="w-4 h-4" /></Button>
                          <Button onClick={() => handleDelete(location.id)} variant="outline" size="sm" className="text-destructive hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
