import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { RetailHeader } from './RetailHeader';
import { getRetailSessionUser } from '../lib/retailAuth';
import { Loader2, Plus, Clock } from 'lucide-react';
import { cn } from './ui/utils';
import { motion, useAnimation, PanInfo } from 'motion/react';
import { RetailMobileTabBar, type TabId } from './RetailMobileTabBar';
import poodleIcon from 'figma:asset/e4d7062dd1d8524f8eb71d94f631a3edd99664b0.png';
import { API_BASE_URL } from '../lib/backendConfig';
import { AddCafeModal } from './AddCafeModal';
import { SEOHelmet, SEOConfig } from './SEOHelmet';

interface Location {
  id: string | number;
  name: string;
  address: string;
  fullAddress: string;
  latitude?: number | null;
  longitude?: number | null;
  coordinates?: [number, number];
}

function parseCoord(v: unknown): number {
  if (v == null || v === '') return NaN;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : NaN;
}

/** Координаты с API могут быть строками; 0,0 из подсказок без center не считаем валидными. */
function hasValidRetailCoords(lat: unknown, lon: unknown): boolean {
  const a = parseCoord(lat);
  const b = parseCoord(lon);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  if (a === 0 && b === 0) return false;
  return true;
}

// Fallback locations if API fails
const fallbackLocations = [
  { name: 'MNTN', address: 'Большая Зеленина 34' },
  { name: 'MNTN', address: 'Кожевенная линия 40 Е' },
  { name: 'MNTN', address: 'Моисеенко 27' },
  { name: 'Vid coffee', address: 'Комендантский проспект 63' },
  { name: 'Vid coffee', address: 'Чкаловский проспект 38' },
  { name: 'Кофе Рейсер', address: 'Введенская 22' },
  { name: 'Мечта', address: 'Большой проспект П.С. 71' },
  { name: 'Рид', address: 'Декабристов 39' },
  { name: 'Капля кофе', address: 'Смоленская 13' },
  { name: 'Капля кофе', address: 'Кузнечный 18' },
  { name: 'Стрелка', address: 'Греческий переулок 11' },
  { name: 'Кофе 3', address: 'наб. реки Карповки 5' },
  { name: 'Пенка', address: 'Восстания 31' },
  { name: 'Gotcha', address: 'Суворовский 40' },
  { name: 'Temple coffee', address: 'проспект Героев 31' },
  { name: 'Подписные издания', address: 'Литейный проспект 57' },
  { name: 'Культура кофе', address: 'Большая Разночинная 21' },
  { name: 'Cake me tender', address: 'Большой проспект В.О 16/14б' },
  { name: 'Завари кофе', address: 'Заводская 2а' },
];

export function LocationsPage() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [cartItemsCount, setCartItemsCount] = useState(0);
  const [favoritesCount, setFavoritesCount] = useState(0);
  
  const [locations, setLocations] = useState<Location[]>([]);
  const [pendingLocations, setPendingLocations] = useState<Location[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const mapRef = useRef<any>(null);
  const mapInstanceRef = useRef<any>(null);
  const clustererRef = useRef<any>(null);
  const placemarksRef = useRef<Map<string | number, any>>(new Map());
  const [selectedLocationId, setSelectedLocationId] = useState<string | number | null>(null);

  // Mobile Sheet Logic
  const [isMobile, setIsMobile] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const controls = useAnimation();
  const [sheetState, setSheetState] = useState<'collapsed' | 'expanded'>('collapsed');
  const [dragConstraints, setDragConstraints] = useState({ top: 0, bottom: 0 });

  const handleTabSelect = (tab: TabId) => {
    switch (tab) {
      case 'home':
        navigate('/');
        break;
      case 'cart':
        navigate('/?action=cart');
        break;
      case 'favorites':
        navigate('/?action=favorites');
        break;
      case 'locations':
        // Already on locations
        break;
      case 'harvest':
        navigate('/harvest');
        break;
      case 'profile':
        if (currentUser) {
            navigate('/dashboard');
        } else {
            navigate('/login');
        }
        break;
    }
  };

  useEffect(() => {
    const updateDimensions = () => {
      const isMob = window.innerWidth < 1024;
      setIsMobile(isMob);
      
      if (isMob) {
        // Calculate the translation Y for the collapsed state
        // Sheet height is window.innerHeight - 20 (from top-20px equivalent logic or h-calc)
        // We want 290px visible.
        const sheetHeight = window.innerHeight - 20; 
        const bottomConstraint = Math.max(0, sheetHeight - 290);
        setDragConstraints({ top: 0, bottom: bottomConstraint });
        
        // Update position based on current state
        if (sheetState === 'collapsed') {
          controls.start({ y: bottomConstraint });
        } else {
          controls.start({ y: 0 });
        }
      }
    };
    
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, [sheetState]); // Re-run if state changes to ensure correct position

  // Auth & Cart State
  useEffect(() => {
    const checkUser = async () => {
      setCurrentUser(getRetailSessionUser());
    };
    checkUser();

    // Load cart count
    try {
      const savedCart = localStorage.getItem('retailCart');
      if (savedCart) {
        const items = JSON.parse(savedCart);
        setCartItemsCount(items.reduce((sum: number, item: any) => sum + item.quantity, 0));
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  // Load locations from API
  useEffect(() => {
    const loadLocations = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/retail-locations`);

        if (!response.ok) throw new Error('Failed to load locations');
        
        const data = await response.json();
        console.log('📍 Loaded locations from API:', data);
        console.log('📍 First location sample:', data[0]);
        
        // If API returns empty data, initialize with default locations
        if (data.length === 0) {
          console.log('No locations found, initializing...');
          try {
            const initResponse = await fetch(`${API_BASE_URL}/retail-locations/init`, {
              method: 'POST',
            });
            
            if (initResponse.ok) {
              const initData = await initResponse.json();
              console.log('Locations initialized:', initData);
              // Reload locations after initialization
              const reloadResponse = await fetch(`${API_BASE_URL}/retail-locations`);
              const reloadData = await reloadResponse.json();
              const initialLocations = reloadData.map((loc: any) => ({
                id: loc.id,
                name: loc.name,
                address: loc.address,
                fullAddress: `Санкт-Петербург, ${loc.address}`,
                latitude: parseCoord(loc.latitude),
                longitude: parseCoord(loc.longitude),
                coordinates: hasValidRetailCoords(loc.latitude, loc.longitude)
                  ? [parseCoord(loc.latitude), parseCoord(loc.longitude)]
                  : undefined,
              }));
              setLocations(initialLocations);
              return;
            }
          } catch (initError) {
            console.error('Failed to initialize locations:', initError);
          }
        }
        
        const initialLocations = data.map((loc: any) => ({
          id: loc.id,
          name: loc.name,
          address: loc.address,
          fullAddress: `Санкт-Петербург, ${loc.address}`,
          latitude: parseCoord(loc.latitude),
          longitude: parseCoord(loc.longitude),
          coordinates: hasValidRetailCoords(loc.latitude, loc.longitude)
            ? [parseCoord(loc.latitude), parseCoord(loc.longitude)]
            : undefined,
        }));
        
        setLocations(initialLocations);
      } catch (error) {
        console.error('Error loading locations, using fallback:', error);
        // Use fallback locations on error
        const initialLocations = fallbackLocations.map((loc, index) => ({
          id: index,
          name: loc.name,
          address: loc.address,
          fullAddress: `Санкт-Петербург, ${loc.address}`,
        }));
        setLocations(initialLocations);
      }
    };

    loadLocations();
  }, []);

  // Load Yandex Maps
  useEffect(() => {
    if (window.ymaps) {
      setMapLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://api-maps.yandex.ru/2.1/?apikey=d273f32f-f343-413c-b1d4-9fc8c0879682&lang=ru_RU';
    script.async = true;
    script.onload = () => {
      window.ymaps.ready(() => {
        setMapLoaded(true);
      });
    };
    document.body.appendChild(script);

    return () => {
      // Cleanup not really needed for global script
    };
  }, []);

  // Initialize Map (once)
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || mapInstanceRef.current) return;

    const initMap = () => {
      const spbCenter = [59.9386, 30.3141];
      const map = new window.ymaps.Map(mapRef.current, {
        center: spbCenter,
        zoom: 10,
        controls: ['zoomControl', 'fullscreenControl']
      });
      mapInstanceRef.current = map;
      console.log('🗺️ Map initialized');
    };

    window.ymaps.ready(initMap);
  }, [mapLoaded]);

  // Add markers when locations change
  useEffect(() => {
    if (!mapInstanceRef.current || !window.ymaps || locations.length === 0) {
      console.log('⏸️ Waiting to add markers...', {
        hasMap: !!mapInstanceRef.current,
        hasYmaps: !!window.ymaps,
        locationsCount: locations.length
      });
      return;
    }

    const addMarkers = async () => {
      const map = mapInstanceRef.current;
      
      // Remove old clusterer if exists
      if (clustererRef.current) {
        map.geoObjects.remove(clustererRef.current);
        console.log('🗑️ Removed old markers');
      }
      
      // Clear old placemark references
      placemarksRef.current.clear();

      // Add markers for locations

      // Custom Cluster Icon Layout (SVG) - Circle with Pink Fill
      const clusterIconSvg = `
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
           <circle cx="24" cy="24" r="22" fill="#FF90A1" stroke="white" stroke-width="2"/>
        </svg>
      `;

      const CustomClusterLayout = window.ymaps.templateLayoutFactory.createClass(
          '<div style="width: 48px; height: 48px; background-image: url(\'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(clusterIconSvg) + '\'); background-size: cover; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-family: sans-serif; font-size: 16px;">$[properties.geoObjects.length]</div>'
      );

      const clusterer = new window.ymaps.Clusterer({
        clusterIconLayout: CustomClusterLayout,
        clusterIconShape: {
            type: 'Rectangle',
            coordinates: [[0, 0], [48, 48]]
        },
        groupByCoordinates: false,
        clusterDisableClickZoom: false,
        clusterHideIconOnBalloonOpen: false,
        geoObjectHideIconOnBalloonOpen: false
      });

      console.log('📍 Starting to add markers for locations:', locations.length);
      
      for (let i = 0; i < locations.length; i++) {
        const loc = locations[i];
        console.log(`📍 Processing location ${i}:`, { 
          name: loc.name, 
          latitude: loc.latitude, 
          longitude: loc.longitude,
          hasCoords: hasValidRetailCoords(loc.latitude, loc.longitude),
        });
        
        try {
          let coords;
          
          // Используем сохраненные координаты если они есть
          if (hasValidRetailCoords(loc.latitude, loc.longitude)) {
            coords = [parseCoord(loc.latitude), parseCoord(loc.longitude)];
            console.log(`✅ Using saved coords for ${loc.name}:`, coords);
          } else {
            // Fallback к геокодированию если координат нет
            console.log(`⚠️ No saved coords for ${loc.name}, geocoding...`);
            const res = await window.ymaps.geocode(loc.fullAddress);
            const firstGeoObject = res.geoObjects.get(0);
            if (firstGeoObject) {
              coords = firstGeoObject.geometry.getCoordinates();
              console.log(`✅ Geocoded coords for ${loc.name}:`, coords);
            }
          }
          
          if (coords) {
            // Create balloon content with improved styling
            const balloonHeader = `<div style="font-weight: 600; font-size: 17px; color: #1a1a1a; font-family: system-ui, -apple-system, sans-serif; padding: 2px 0;">${loc.name}</div>`;
            const balloonBody = `
              <div style="font-family: system-ui, -apple-system, sans-serif; color: #222; min-width: 220px; padding: 4px 0;">
                <div style="margin-bottom: 16px; font-size: 14px; opacity: 0.75; line-height: 1.5;">${loc.address}</div>
                <a href="https://yandex.ru/maps/?rtext=~${coords[0]},${coords[1]}" target="_blank" rel="noopener noreferrer" style="display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 12px 20px; background: linear-gradient(135deg, #E8A0BF 0%, #FF90A1 100%); color: white; text-decoration: none; border-radius: 12px; font-size: 14px; font-weight: 600; width: 100%; box-sizing: border-box; transition: all 0.2s; box-shadow: 0 2px 8px rgba(232, 160, 191, 0.3);" onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 4px 12px rgba(232, 160, 191, 0.4)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 8px rgba(232, 160, 191, 0.3)';">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                  Построить маршрут
                </a>
              </div>
            `;

            // Use custom icon layout
            const placemark = new window.ymaps.Placemark(coords, {
              balloonContentHeader: balloonHeader,
              balloonContentBody: balloonBody,
              hintContent: loc.name
            }, {
              iconLayout: 'default#image',
              iconImageHref: poodleIcon,
              iconImageSize: [40, 40],
              iconImageOffset: [-20, -20]
            });

            // Add click event to highlight in list
            placemark.events.add('click', () => {
              setSelectedLocationId(loc.id);
            });

            // Save placemark reference
            placemarksRef.current.set(loc.id, placemark);

            clusterer.add(placemark);
            console.log(`✅ Added placemark for ${loc.name} (ID: ${loc.id})`, {
              coords,
              hasGeometry: !!placemark.geometry,
              hasBalloon: !!placemark.balloon
            });
          } else {
            console.warn('❌ No coordinates found for', loc.fullAddress);
          }
        } catch (e) {
          console.error('❌ Geocoding error for', loc.fullAddress, e);
        }
      }

      console.log(`📍 Total placemarks added to clusterer: ${clusterer.getGeoObjects().length}`);
      console.log(`📍 Placemarks stored in ref:`, Array.from(placemarksRef.current.keys()));
      
      map.geoObjects.add(clusterer);
      clustererRef.current = clusterer;
      
      // Fit bounds to show all markers
      if (clusterer.getGeoObjects().length > 0) {
        map.setBounds(clusterer.getBounds(), {
          checkZoomRange: true,
          zoomMargin: 50
        });
      }
    };

    addMarkers();
  }, [locations]);

  const handleLocationClick = (loc: Location) => {
    setSelectedLocationId(loc.id);
    
    // Get coordinates - either from loc or from locations state
    const coords =
      loc.coordinates ||
      (hasValidRetailCoords(loc.latitude, loc.longitude)
        ? [parseCoord(loc.latitude), parseCoord(loc.longitude)]
        : null);
    
    if (!coords) {
      console.warn('⚠️ No coordinates for location', loc.name);
      return;
    }
    
    if (!mapInstanceRef.current) {
      console.warn('⚠️ Map not initialized');
      return;
    }
    
    const map = mapInstanceRef.current;

    // Helper: center map and open balloon for this location
    const focusAndOpen = (retryCount = 0) => {
      const placemark = placemarksRef.current.get(loc.id);

      if (!placemark) {
        if (retryCount < 10) {
          // Markers may still be loading (geocoding async) — retry up to 10 times
          setTimeout(() => focusAndOpen(retryCount + 1), 200);
        } else {
          // Fallback: at least center the map, no balloon
          console.warn('⚠️ Placemark not found after retries for', loc.id, loc.name);
          map.setCenter(coords, 16, { duration: 500 });
        }
        return;
      }

      // Close any open balloons first
      try {
        if (placemark.balloon.isOpen()) {
          placemark.balloon.close();
        }
      } catch (e) {
        // Ignore if balloon methods not available
      }

      // Center map on location with zoom
      map.setCenter(coords, 16, {
        duration: 500
      }).then(() => {
        // Open balloon after map animation completes
        setTimeout(() => {
          try {
            placemark.balloon.open();
            console.log('🎈 Opened balloon for', loc.name);
          } catch (e) {
            console.error('⚠️ Error opening balloon:', e);
          }
        }, 100);
      }).catch((e: any) => {
        console.error('⚠️ Error setting map center:', e);
      });
    };

    focusAndOpen();

    // Collapse sheet on mobile selection so user can see the map
    if (isMobile) {
      controls.start({ y: dragConstraints.bottom });
      setSheetState('collapsed');
    }
  };

  const onDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    // Determine direction and intent
    const offset = info.offset.y;
    const velocity = info.velocity.y;
    const bottomLimit = dragConstraints.bottom;
    
    // Thresholds for changing state
    const expandThreshold = -100;
    const collapseThreshold = 100;

    // If dragging up (negative) fast or far enough -> Expand
    if (velocity < -500 || offset < expandThreshold) {
      controls.start({ y: 0 });
      setSheetState('expanded');
    } 
    // If dragging down (positive) fast or far enough -> Collapse
    else if (velocity > 500 || offset > collapseThreshold) {
      controls.start({ y: bottomLimit });
      setSheetState('collapsed');
    } 
    // Otherwise snap to nearest
    else {
      // Find current y (approximate from offset + start)
      // Simpler: just revert to current state if gesture wasn't strong enough
      // Or we can check which state we are closer to.
      // For now, reverting to the state before drag (or the one we are closest to) is fine.
      // Let's stick to the previous state logic for "cancel" feeling unless crossed midpoint?
      // Actually, snap back is safer.
      controls.start({ y: sheetState === 'expanded' ? 0 : bottomLimit });
    }
  };

  const handleHeaderClick = () => {
    if (sheetState === 'collapsed') {
      controls.start({ y: 0 });
      setSheetState('expanded');
    } else {
      controls.start({ y: dragConstraints.bottom });
      setSheetState('collapsed');
    }
  };

  const LocationListItems = () => (
    <>
      {locations.map((loc) => (
        <div
          key={loc.id}
          onClick={() => handleLocationClick(loc)}
          className={cn(
            "py-4 px-3 -mx-3 cursor-pointer transition-all duration-200 border-b border-[#222222]/10 last:border-0 rounded-lg",
            selectedLocationId === loc.id
              ? "opacity-100 bg-[#FF90A1]/10"
              : "opacity-70 hover:opacity-100 hover:bg-[#222222]/5"
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <div className={cn(
                "font-bold text-lg mb-1 transition-colors",
                selectedLocationId === loc.id ? "text-[#FF90A1]" : "text-[#222222]"
              )}>{loc.name}</div>
              <div className="text-sm text-[#222222]/60">
                {loc.address}
              </div>
            </div>
            <div className={cn(
              "flex-shrink-0 mt-1 transition-colors",
              selectedLocationId === loc.id ? "text-[#FF90A1]" : "text-[#222222]/30"
            )}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
            </div>
          </div>
        </div>
      ))}
      {/* Pending (awaiting approval) locations */}
      {pendingLocations.map((loc) => (
        <div
          key={`pending-${loc.id}`}
          className="py-4 px-3 -mx-3 border-b border-[#222222]/10 last:border-0 rounded-lg opacity-60"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-bold text-lg text-[#222222]">{loc.name}</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 border border-amber-200 text-amber-700 text-[10px] font-medium">
                  <Clock className="w-2.5 h-2.5" />
                  Ждёт одобрения
                </span>
              </div>
              <div className="text-sm text-[#222222]/60">{loc.address}</div>
            </div>
          </div>
        </div>
      ))}
    </>
  );

  return (
    <div className="h-screen bg-[#FFF4E5] flex flex-col font-sans overflow-hidden">
      <SEOHelmet {...SEOConfig.locations} />
      <RetailHeader 
        className="flex-none"
        currentUser={currentUser}
        cartItemsCount={cartItemsCount}
        validFavoritesCount={favoritesCount}
        onNavigateToLogin={() => navigate('/login')}
        onOpenFavorites={() => navigate('/')} 
        onOpenCart={() => navigate('/')} 
      />

      <div ref={containerRef} className="flex-grow flex flex-col lg:flex-row relative overflow-hidden">
        {/* Desktop Sidebar */}
        <div className="hidden lg:flex w-[420px] flex-none bg-[#FFF4E5] flex-col border-r border-[#222222]/10 z-10">
          <div className="p-6 pb-4 flex-none">
            <h1 className="text-3xl font-medium text-[#222222] mb-1">Где купить</h1>
            <p className="text-sm text-[#222222]/60 mb-3">Кофейни-партнеры</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 text-sm text-[#FF90A1] font-medium hover:text-[#FF7A93] transition-colors"
            >
              <Plus className="w-4 h-4" />
              Добавить кофейню
            </button>
          </div>
          <div className="overflow-y-auto flex-1 custom-scrollbar px-6 pb-6">
            <LocationListItems />
          </div>
        </div>

        {/* Map Section - Fullscreen on mobile, right side on desktop */}
        <div className={`
          ${isMobile ? 'absolute inset-0 z-0' : 'flex-grow relative z-0'}
          bg-[#F5F5F5]
        `}>
          {!mapLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#F5F5F5] z-20">
              <Loader2 className="w-8 h-8 animate-spin text-[#222222]/40" />
            </div>
          )}
          <div ref={mapRef} className="w-full h-full" />
        </div>

        {/* Mobile Bottom Sheet */}
        {isMobile && (
          <motion.div
            initial={{ y: "calc(100% - 290px)" }} // Initial visual state before hydration/resize effect
            animate={controls}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: dragConstraints.bottom }}
            dragElastic={0.05}
            onDragEnd={onDragEnd}
            className="absolute bottom-0 left-0 right-0 h-[calc(100%-20px)] bg-[#FFF4E5] rounded-t-[20px] shadow-[0_-5px_20px_rgba(0,0,0,0.15)] z-20 flex flex-col"
          >
            {/* Drag Handle & Header */}
            <div 
              className="flex-none pt-3 pb-4 cursor-grab active:cursor-grabbing text-center border-b border-[#222222]/10"
              onClick={handleHeaderClick}
            >
              {/* Drag Handle */}
              <div className="w-12 h-1.5 bg-gray-400/50 rounded-full mx-auto mb-4" />
              
              <h1 className="text-xl font-medium text-[#222222] mb-0.5">Где купить</h1>
              <p className="text-xs text-[#222222]/60 mb-2">Кофейни-партнеры</p>
              <button
                onClick={(e) => { e.stopPropagation(); setShowAddModal(true); }}
                className="inline-flex items-center gap-1.5 text-xs text-[#FF90A1] font-medium"
              >
                <Plus className="w-3.5 h-3.5" />
                Добавить кофейню
              </button>
            </div>

            {/* Scrollable Content */}
            <div 
              className={cn(
                "flex-1 px-6 pb-20 custom-scrollbar",
                sheetState === 'expanded' ? "overflow-y-auto" : "overflow-hidden"
              )}
              onPointerDownCapture={(e) => {
                if (sheetState === 'expanded') {
                   e.stopPropagation();
                }
              }}
            >
              <LocationListItems />
            </div>
          </motion.div>
        )}
      </div>

      <RetailMobileTabBar
        currentTab="locations"
        onTabSelect={handleTabSelect}
        cartItemsCount={cartItemsCount}
        favoritesCount={favoritesCount}
      />

      {/* Add Cafe Modal */}
      {showAddModal && (
        <AddCafeModal
          onClose={() => setShowAddModal(false)}
          onSubmitted={(loc) => {
            setPendingLocations(prev => [...prev, {
              id: loc.id,
              name: loc.name,
              address: loc.address,
              fullAddress: loc.address,
              latitude: loc.latitude,
              longitude: loc.longitude,
            }]);
          }}
        />
      )}
    </div>
  );
}

// Add types for Yandex Maps
declare global {
  interface Window {
    ymaps: any;
  }
}