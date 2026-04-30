import { useState, useEffect, useRef } from 'react';
import { MapPin, Package, Clock, Phone, Search, X, ChevronRight, Loader2, Pencil } from 'lucide-react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from './ui/dialog';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import type { RetailProduct } from '../lib/api';
import { toast } from 'sonner';
import { cn } from './ui/utils';

interface PickupPoint {
  code: string;
  name: string;
  address: string;
  location: {
    latitude: number;
    longitude: number;
  };
  work_time: string;
  phones: Array<{ number: string }>;
}

interface CdekDeliveryProps {
  orderPrice: number;
  cartItems?: Array<{
    product: RetailProduct;
    quantity: number;
    weight: string;
    grind: string;
  }>;
  onDeliveryChange: (delivery: {
    city: string;
    pvzCode: string;
    pvzAddress: string;
    cost: number;
    days: number;
    tariffCode?: number;
  } | null) => void;
}

interface CitySuggestion {
  code: number;
  city: string;
  region: string;
  country: string;
  country_code?: string;
  city_code: number;
  full_name: string;
  latitude: number;
  longitude: number;
}

declare global {
  interface Window {
    ymaps: any;
  }
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || `https://${projectId}.supabase.co/functions/v1/make-server-aa167a09`;
const API_AUTH_HEADER = API_BASE_URL.includes("supabase.co")
  ? { Authorization: `Bearer ${publicAnonKey}` }
  : {};

export function CdekDelivery({ orderPrice, cartItems, onDeliveryChange }: CdekDeliveryProps) {
  const [cityInput, setCityInput] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedCityCode, setSelectedCityCode] = useState<number | null>(null);
  const [citySuggestions, setCitySuggestions] = useState<CitySuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [deliveryCost, setDeliveryCost] = useState<number | null>(null);
  const [deliveryDays, setDeliveryDays] = useState<number | null>(null);
  const [isFreeShipping, setIsFreeShipping] = useState(false);
  const [pickupPoints, setPickupPoints] = useState<PickupPoint[]>([]);
  const [selectedPvz, setSelectedPvz] = useState<string>('');
  const [isLoadingCost, setIsLoadingCost] = useState(false);
  const [isLoadingPvz, setIsLoadingPvz] = useState(false);
  const [cityError, setCityError] = useState<string>('');
  const [tariffCode, setTariffCode] = useState<number | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [cityCoordinates, setCityCoordinates] = useState<[number, number] | null>(null);
  
  const [isMapOpen, setIsMapOpen] = useState(false);
  
  const mapRef = useRef<any>(null);
  const mapInstanceRef = useRef<any>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load Yandex Maps API
  useEffect(() => {
    if (window.ymaps) {
      window.ymaps.ready(() => setMapLoaded(true));
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://api-maps.yandex.ru/2.1/?apikey=d273f32f-f343-413c-b1d4-9fc8c0879682&lang=ru_RU';
    script.async = true;
    script.onload = () => {
      window.ymaps.ready(() => setMapLoaded(true));
    };
    document.body.appendChild(script);

    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, []);

  // Initialize map when dialog opens
  useEffect(() => {
    if (isMapOpen && mapLoaded && cityCoordinates && pickupPoints.length > 0) {
      // Small delay to allow dialog animation to finish and refs to be ready
      setTimeout(initMap, 200);
    }
  }, [isMapOpen, mapLoaded, cityCoordinates, pickupPoints]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search for city suggestions
  useEffect(() => {
    if (cityInput.length < 2 || cityInput === selectedCity) {
      setCitySuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/cdek/cities?q=${encodeURIComponent(cityInput)}`,
          {
            headers: {
              ...API_AUTH_HEADER
            }
          }
        );

        if (!response.ok) return;

        const data = await response.json();
        setCitySuggestions(data.cities || []);
        setShowSuggestions((data.cities || []).length > 0);
      } catch (error) {
        console.error('Error fetching city suggestions:', error);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [cityInput, selectedCity]);

  // Load delivery info when city is selected
  useEffect(() => {
    if (!selectedCity.trim()) {
      setDeliveryCost(null);
      setDeliveryDays(null);
      setPickupPoints([]);
      setSelectedPvz('');
      setCityError('');
      setCityCoordinates(null);
      onDeliveryChange(null);
      return;
    }

    loadDeliveryInfo();
  }, [selectedCity, orderPrice]);

  // Notify parent when delivery changes
  useEffect(() => {
    if (selectedCity && selectedPvz && deliveryCost !== null && deliveryDays !== null) {
      const selectedPoint = pickupPoints.find(p => p.code === selectedPvz);
      if (selectedPoint) {
        onDeliveryChange({
          city: selectedCity,
          pvzCode: selectedPvz,
          pvzAddress: selectedPoint.address,
          cost: deliveryCost,
          days: deliveryDays,
          tariffCode: tariffCode || undefined
        });
      }
    } else {
      onDeliveryChange(null);
    }
  }, [selectedCity, selectedPvz, deliveryCost, deliveryDays, pickupPoints, tariffCode]);

  const handleCitySelect = (suggestion: CitySuggestion) => {
    setSelectedCity(suggestion.city);
    setSelectedCityCode(suggestion.code);
    setCityInput(suggestion.city);
    setCityCoordinates([suggestion.latitude, suggestion.longitude]);
    setShowSuggestions(false);
  };

  const clearCity = () => {
    setCityInput('');
    setSelectedCity('');
    setSelectedCityCode(null);
    setCitySuggestions([]);
    setShowSuggestions(false);
    setCityCoordinates(null);
  };

  const loadDeliveryInfo = async () => {
    setIsLoadingPvz(true);
    setCityError('');
    setDeliveryCost(null);
    setDeliveryDays(null);
    setSelectedPvz('');

    try {
      const pvzResponse = await fetch(
        `${API_BASE_URL}/cdek/pvz`,
        {
          method: 'POST',
          headers: {
            ...API_AUTH_HEADER,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            city_to: selectedCity,
            city_code: selectedCityCode
          })
        }
      );

      if (!pvzResponse.ok) {
        setCityError('Город не найден');
        setPickupPoints([]);
        return;
      }

      const pvzData = await pvzResponse.json();
      setPickupPoints(pvzData.pickup_points || []);

      if (pvzData.pickup_points && pvzData.pickup_points.length === 0) {
        setCityError('В этом городе нет пунктов выдачи СДЭК');
      }

    } catch (error) {
      console.error('Error loading CDEK delivery info:', error);
      setCityError('Ошибка загрузки пунктов выдачи');
    } finally {
      setIsLoadingPvz(false);
    }
  };

  const calculateDeliveryCost = async (pvzCode: string) => {
    setIsLoadingCost(true);
    setCityError('');

    try {
      const packages = cartItems && cartItems.length > 0
        ? cartItems.map(item => ({
            weight: item.product.packageWeight || 500,
            length: item.product.packageLength || 20,
            width: item.product.packageWidth || 15,
            height: item.product.packageHeight || 10,
            quantity: item.quantity
          }))
        : undefined;

      const calcResponse = await fetch(
        `${API_BASE_URL}/cdek/calc`,
        {
          method: 'POST',
          headers: {
            ...API_AUTH_HEADER,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            city_to: selectedCity,
            city_code: selectedCityCode,
            pvz_code: pvzCode,
            order_price: orderPrice,
            packages: packages
          })
        }
      );

      if (!calcResponse.ok) {
        const error = await calcResponse.json();
        setCityError(error.error || 'Ошибка при расчете стоимости доставки');
        setDeliveryCost(null);
        setDeliveryDays(null);
        return;
      }

      const calcData = await calcResponse.json();
      setDeliveryCost(calcData.delivery_cost);
      setDeliveryDays(calcData.delivery_days);
      setIsFreeShipping(calcData.is_free || false);
      setTariffCode(calcData.tariff_code || null);

    } catch (error) {
      console.error('Error calculating delivery cost:', error);
      setCityError('Ошибка при расчете стоимости доставки');
    } finally {
      setIsLoadingCost(false);
    }
  };

  const initMap = () => {
    if (!window.ymaps || !cityCoordinates || !mapRef.current) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.destroy();
    }

    const map = new window.ymaps.Map(mapRef.current, {
      center: cityCoordinates,
      zoom: 11,
      controls: ['zoomControl']
    });

    mapInstanceRef.current = map;

    pickupPoints.forEach((pvz) => {
      const placemark = new window.ymaps.Placemark(
        [pvz.location.latitude, pvz.location.longitude],
        {
          balloonContentHeader: `<div style="font-size: 14px; font-weight: 600; padding-right: 20px;">${pvz.name}</div>`,
          balloonContentBody: `
            <div style="font-family: system-ui, sans-serif; max-width: 240px;">
              <div style="margin-bottom: 8px; font-size: 13px; line-height: 1.4; word-wrap: break-word;">${pvz.address}</div>
              ${pvz.work_time ? `<div style="font-size: 12px; color: #666; margin-bottom: 12px;">${pvz.work_time}</div>` : ''}
              <button 
                id="select-pvz-${pvz.code}" 
                style="width: 100%; background: #222; color: white; border: none; padding: 10px; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 500;"
              >
                Выбрать этот пункт
              </button>
            </div>
          `
        },
        {
          preset: selectedPvz === pvz.code ? 'islands#blackDotIcon' : 'islands#blueCircleDotIcon',
          iconColor: selectedPvz === pvz.code ? '#222222' : '#FF90A1',
          balloonMaxWidth: 300,
          hideIconOnBalloonOpen: false
        }
      );

      placemark.events.add('balloonopen', () => {
        setTimeout(() => {
          const button = document.getElementById(`select-pvz-${pvz.code}`);
          if (button) {
            button.onclick = () => {
              setSelectedPvz(pvz.code);
              calculateDeliveryCost(pvz.code);
              map.balloon.close();
              setIsMapOpen(false); // Закрываем модальное окно после выбора
            };
          }
        }, 100);
      });

      map.geoObjects.add(placemark);
    });
  };

  const selectedPoint = pickupPoints.find(p => p.code === selectedPvz);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-lg text-[#222222]">Доставка</h3>
        <p className="text-xs text-[#222222]/60 mt-1">Доставка от 3500 ₽ — бесплатно</p>
      </div>

      <div className="relative">
        <label className="text-xs text-[#222222]/70 mb-1.5 block">Город доставки</label>
        <div className="relative">
          <Input
            ref={inputRef}
            placeholder="Начните вводить название..."
            value={cityInput}
            onChange={(e) => setCityInput(e.target.value)}
            onFocus={() => {
              if (citySuggestions.length > 0) setShowSuggestions(true);
            }}
            className={cn(
              "bg-[#FFF4E5] border border-[#222222]/10 pr-10 h-11 transition-all focus:ring-2 focus:ring-[#FF90A1]/20", 
              cityError && "border-red-500 focus:border-red-500 focus:ring-red-500/20"
            )}
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {cityInput && (
              <button onClick={clearCity} className="p-1 hover:bg-[#FF90A1]/20 rounded-full transition-colors" type="button">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
            {!cityInput && <Search className="w-4 h-4 text-muted-foreground" />}
          </div>
        </div>

        {/* Suggestions */}
        {showSuggestions && citySuggestions.length > 0 && (
          <div ref={suggestionsRef} className="absolute z-50 w-full mt-1 bg-[#FFF4E5] border border-[#222222]/10 rounded-xl max-h-[300px] overflow-y-auto">
            {citySuggestions.map((suggestion) => (
              <button
                key={suggestion.code}
                type="button"
                onClick={() => handleCitySelect(suggestion)}
                className="w-full text-left px-4 py-3 hover:bg-[#222222]/5 transition-colors border-b last:border-b-0 border-[#222222]/5"
              >
                <div className="font-medium text-sm">{suggestion.city}</div>
                <div className="text-xs text-muted-foreground">{suggestion.full_name}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {cityError && (
        <p className="text-red-500 text-xs mt-1 bg-red-50 p-2 rounded-lg border border-red-100 flex items-center gap-2">
            <span className="w-1 h-1 bg-red-500 rounded-full" />
            {cityError}
        </p>
      )}

      {/* Main Delivery Selection UI */}
      {selectedCity && !cityError && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
           
           {/* PVZ Selector */}
           <div>
              <label className="text-xs text-[#222222]/70 mb-1.5 block">Пункт выдачи СДЭК</label>
              
              {selectedPvz && selectedPoint ? (
                <div className="border border-[#FF90A1] bg-[#FFF4E5] rounded-xl overflow-hidden relative group">
                   <div className="p-4">
                      <div className="flex items-start gap-3 mb-3">
                         <div className="w-8 h-8 rounded-full bg-[#FF90A1]/20 flex items-center justify-center shrink-0 text-[#222222]">
                            <MapPin className="w-4 h-4" />
                         </div>
                         <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-[#222222] text-sm leading-tight mb-1 pr-8">{selectedPoint.name}</h4>
                            <p className="text-xs text-muted-foreground leading-relaxed">{selectedPoint.address}</p>
                         </div>
                      </div>
                      
                      <div className="flex items-center gap-4 text-xs text-muted-foreground border-t border-[#FF90A1]/20 pt-3 mt-1">
                         {selectedPoint.work_time && (
                            <div className="flex items-center gap-1.5">
                               <Clock className="w-3.5 h-3.5" />
                               <span className="truncate">{selectedPoint.work_time}</span>
                            </div>
                         )}
                      </div>
                   </div>

                   {/* Cost & Time Badge */}
                   {(deliveryCost !== null || isLoadingCost) && (
                      <div className="bg-[#FF90A1]/10 px-4 py-2 flex items-center justify-between text-sm">
                         <div className="flex items-center gap-2 text-[#222222]/80">
                            <Package className="w-4 h-4" />
                            {isLoadingCost ? (
                               <span>Считаем...</span>
                            ) : (
                               <span>
                                  {deliveryDays} {deliveryDays === 1 ? 'день' : 'дней'}
                               </span>
                            )}
                         </div>
                         <div className="font-semibold text-[#222222]">
                            {isLoadingCost ? (
                               <Loader2 className="w-4 h-4 animate-spin" />
                            ) : isFreeShipping ? (
                               <span className="text-green-600">Бесплатно</span>
                            ) : (
                               <span>{deliveryCost} ₽</span>
                            )}
                         </div>
                      </div>
                   )}
                   
                   <Button 
                      variant="ghost" 
                      size="icon" 
                      className="absolute top-2 right-2 h-8 w-8 hover:bg-[#FF90A1]/20 rounded-full"
                      onClick={() => setIsMapOpen(true)}
                   >
                      <Pencil className="w-4 h-4" />
                   </Button>
                </div>
              ) : (
                <Button 
                  variant="outline" 
                  className="w-full h-auto py-4 px-4 justify-between bg-[#FFF4E5] border-dashed border-2 border-[#222222]/10 hover:border-[#FF90A1] hover:bg-[#FF90A1]/5 hover:text-[#222222] transition-all group"
                  onClick={() => setIsMapOpen(true)}
                >
                   <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#222222]/5 group-hover:bg-[#FFF4E5] transition-colors flex items-center justify-center">
                         <MapPin className="w-5 h-5 text-muted-foreground group-hover:text-[#FF90A1]" />
                      </div>
                      <div className="text-left">
                         <div className="font-medium text-[#222222]">Выбрать пункт выдачи</div>
                         <div className="text-xs text-muted-foreground group-hover:text-[#222222]/70">На карте</div>
                      </div>
                   </div>
                   <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-[#222222] transition-transform group-hover:translate-x-1" />
                </Button>
              )}
           </div>
        </div>
      )}

      {/* Map Modal */}
      <Dialog open={isMapOpen} onOpenChange={setIsMapOpen}>
        <DialogContent className="max-w-[95vw] w-[800px] p-0 gap-0 overflow-hidden h-[80vh] sm:h-[600px] flex flex-col bg-[#FFF4E5] border border-[#222222]/10 rounded-2xl">
          <DialogHeader className="p-4 border-b bg-[#FFF4E5] z-10">
            <DialogTitle className="flex items-center gap-2">
               <MapPin className="w-5 h-5 text-[#FF90A1]" />
               Выберите пункт выдачи
            </DialogTitle>
            <DialogDescription className="sr-only">
              Карта для выбора пункта выдачи СДЭК
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 relative bg-secondary/20">
             <div ref={mapRef} className="absolute inset-0 w-full h-full" />
             {!mapLoaded && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#FFF4E5]/80 z-20">
                   <Loader2 className="w-8 h-8 animate-spin text-[#FF90A1]" />
                </div>
             )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
