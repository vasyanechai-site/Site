import React, { useState, useRef, useEffect } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Download, X } from 'lucide-react';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import baseImage from 'figma:asset/da86eda3aa0b3673f383844dd2a79141efbb39e5.png';
import rareBadge from 'figma:asset/3dcaaf2bcb1e31e8cfea5d02934ee73987861f97.png';
import drip10Cover from '../../../assets/retail-cover-drip-10.png';

// Определение стран с цветами
const COUNTRIES = [
  { name: 'Эфиопия', color: '#A8C69F' },
  { name: 'Бразилия', color: '#F9C74F' },
  { name: 'Кения', color: '#FFB3C1' },
  { name: 'Колумбия', color: '#FF8C42' },
  { name: 'Индонезия', color: '#F9C74F' },
  { name: 'Бурундия', color: '#B4A7D6' },
  { name: 'Руанда', color: '#90B8D8' },
  { name: 'Гватемала', color: '#F9C74F' },
  { name: 'Коста-Рика', color: '#A8C69F' },
  { name: 'Танзания', color: '#C8B6E2' },
  { name: 'Уганда', color: '#FF8C42' },
  { name: 'Перу', color: '#FFB3C1' },
  { name: 'Китай', color: '#B4A7D6' },
  { name: 'Мексика', color: '#90B8D8' },
] as const;

// Определение вкусов с цветами
const FLAVORS = [
  { name: 'Кислый', color: '#FFB3C1' },
  { name: 'Ореховый', color: '#A8C69F' },
  { name: 'Алкогольный', color: '#90B8D8' },
  { name: 'Шоколадный', color: '#F9C74F' },
  { name: 'Сладкий', color: '#FF8C42' },
  { name: 'Ягодный', color: '#C8B6E2' },
] as const;

interface BadgeData {
  text: string;
  color: string;
}

type CoverProductType = 'coffee' | 'drip6' | 'drip10';

export function RetailCoverConstructor() {
  const [productType, setProductType] = useState<CoverProductType>('coffee');
  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const [selectedFlavor, setSelectedFlavor] = useState<string>('');
  const [selectedDripFlavors, setSelectedDripFlavors] = useState<string[]>([]);
  const [isRareLot, setIsRareLot] = useState<boolean>(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  // Получаем данные выбранных бейджей
  const getCountryBadge = (): BadgeData | null => {
    const country = COUNTRIES.find(c => c.name === selectedCountry);
    return country ? { text: country.name, color: country.color } : null;
  };

  const getFlavorBadge = (): BadgeData | null => {
    const flavor = FLAVORS.find(f => f.name === selectedFlavor);
    return flavor ? { text: flavor.name, color: flavor.color } : null;
  };

  // Render preview on canvas
  useEffect(() => {
    renderPreview();
  }, [selectedCountry, selectedFlavor, selectedDripFlavors, isRareLot, productType]);

  const isDripMode = productType === 'drip6' || productType === 'drip10';
  const activeCoverSrc = productType === 'drip10' ? drip10Cover : baseImage;

  const renderPreview = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Wait for fonts to load
    try {
      await document.fonts.ready;
      // Дополнительная проверка на загрузку конкретного шрифта
      await document.fonts.load('100 16px "Mabry Mono Pro"');
      await document.fonts.load('100 16px "Mabry Pro"');
    } catch (error) {
      console.log('Font loading skipped:', error);
    }

    // Set canvas size
    canvas.width = 1000;
    canvas.height = 1000;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw base image
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = async () => {
      ctx.drawImage(img, 0, 0, 1000, 1000);

      // Draw badges if selected
      if (productType === 'coffee') {
        const countryBadge = getCountryBadge();
        const flavorBadge = getFlavorBadge();

        if (countryBadge || flavorBadge) {
          drawBadges(ctx, countryBadge, flavorBadge);
        }
      } else {
        // Дрипы (6) и (10) — те же бейджи вкусов
        drawDripFlavors(ctx);
      }

      // Draw rare lot badge if selected (only for coffee)
      if (isRareLot && productType === 'coffee') {
        await drawRareBadge(ctx);
      }
    };
    img.src = activeCoverSrc;
  };

  const drawBadges = (
    ctx: CanvasRenderingContext2D,
    countryBadge: BadgeData | null,
    flavorBadge: BadgeData | null
  ) => {
    // Точные значения из дизайна
    const badgeHeight = 79.84;
    const badgePaddingX = 28;
    const fontSize = 52.144;
    const lineHeight = 44.115;
    const letterSpacing = -1;
    const topMargin = 30;
    const gap = 7.677; // Расстояние между бейджами из дизайна

    // Настройка шрифта - Mabry Mono Pro
    ctx.font = `200 ${fontSize}px "Mabry Mono Pro", "Mabry Pro", monospace`;
    ctx.textBaseline = 'middle';

    const badges: BadgeData[] = [];
    if (countryBadge) badges.push(countryBadge);
    if (flavorBadge) badges.push(flavorBadge);

    // Измеряем ширину бейджей с учетом letter-spacing
    const badgeWidths = badges.map(badge => {
      const textWidth = ctx.measureText(badge.text).width;
      // Добавляем letter-spacing к ширине текста
      const adjustedTextWidth = textWidth + (badge.text.length - 1) * letterSpacing;
      return adjustedTextWidth + badgePaddingX * 2;
    });

    // Общая ширина всех бейджей с отступами
    const totalWidth = badgeWidths.reduce((sum, w) => sum + w, 0) + gap * (badges.length - 1);
    
    // Начальная позиция X для центрирования
    let currentX = (1000 - totalWidth) / 2;

    // Рисуем каждый бейдж
    badges.forEach((badge, index) => {
      const badgeWidth = badgeWidths[index];

      // Рисуем фон бейджа
      ctx.fillStyle = badge.color;
      ctx.fillRect(currentX, topMargin, badgeWidth, badgeHeight);

      // Рисуем текст
      ctx.fillStyle = '#000000';
      const textX = currentX + badgeWidth / 2;
      const textY = topMargin + badgeHeight / 2;
      
      ctx.textAlign = 'center';
      
      // Применяем letter-spacing вручную для canvas
      if (letterSpacing !== 0) {
        const chars = badge.text.split('');
        const totalTextWidth = chars.reduce((sum, char, i) => {
          const charWidth = ctx.measureText(char).width;
          return sum + charWidth + (i < chars.length - 1 ? letterSpacing : 0);
        }, 0);
        
        let charX = textX - totalTextWidth / 2;
        chars.forEach((char, i) => {
          const charWidth = ctx.measureText(char).width;
          ctx.fillText(char, charX + charWidth / 2, textY);
          charX += charWidth + letterSpacing;
        });
      } else {
        ctx.fillText(badge.text, textX, textY);
      }

      // Переходим к следующей позиции
      currentX += badgeWidth + gap;
    });
  };

  const drawDripFlavors = (ctx: CanvasRenderingContext2D) => {
    if (selectedDripFlavors.length === 0) return;

    // Точные значения из дизайна
    const badgeHeight = 79.84;
    const badgePaddingX = 28;
    const fontSize = 52.144;
    const letterSpacing = -1;
    const topMargin = 30;
    const gap = 7.677; // Расстояние между бейджами

    // Настройка шрифта
    ctx.font = `200 ${fontSize}px "Mabry Mono Pro", "Mabry Pro", monospace`;
    ctx.textBaseline = 'middle';

    // Разбиваем на 2 ряда: 3 сверху, 2 снизу
    const firstRow = selectedDripFlavors.slice(0, 3);
    const secondRow = selectedDripFlavors.slice(3, 5);

    const drawRow = (flavors: string[], y: number) => {
      const badges = flavors.map(name => {
        const flavor = FLAVORS.find(f => f.name === name);
        return { text: name, color: flavor?.color || '#000' };
      });

      // Измеряем ширину бейджей
      const badgeWidths = badges.map(badge => {
        const textWidth = ctx.measureText(badge.text).width;
        const adjustedTextWidth = textWidth + (badge.text.length - 1) * letterSpacing;
        return adjustedTextWidth + badgePaddingX * 2;
      });

      // Общая ширина всех бейджей с отступами
      const totalWidth = badgeWidths.reduce((sum, w) => sum + w, 0) + gap * (badges.length - 1);
      
      // Начальная позиция X для центрирования
      let currentX = (1000 - totalWidth) / 2;

      // Рисуем каждый бейдж
      badges.forEach((badge, index) => {
        const badgeWidth = badgeWidths[index];

        // Рисуем фон бейджа
        ctx.fillStyle = badge.color;
        ctx.fillRect(currentX, y, badgeWidth, badgeHeight);

        // Рисуем текст
        ctx.fillStyle = '#000000';
        const textX = currentX + badgeWidth / 2;
        const textY = y + badgeHeight / 2;
        
        ctx.textAlign = 'center';
        
        // Применяем letter-spacing вручную
        if (letterSpacing !== 0) {
          const chars = badge.text.split('');
          const totalTextWidth = chars.reduce((sum, char, i) => {
            const charWidth = ctx.measureText(char).width;
            return sum + charWidth + (i < chars.length - 1 ? letterSpacing : 0);
          }, 0);
          
          let charX = textX - totalTextWidth / 2;
          chars.forEach((char) => {
            const charWidth = ctx.measureText(char).width;
            ctx.fillText(char, charX + charWidth / 2, textY);
            charX += charWidth + letterSpacing;
          });
        } else {
          ctx.fillText(badge.text, textX, textY);
        }

        currentX += badgeWidth + gap;
      });
    };

    // Рисуем первый ряд
    drawRow(firstRow, topMargin);
    
    // Рисуем второй ряд (если есть)
    if (secondRow.length > 0) {
      drawRow(secondRow, topMargin + badgeHeight + gap);
    }
  };

  const drawRareBadge = (ctx: CanvasRenderingContext2D): Promise<void> => {
    return new Promise((resolve) => {
      // Размер бейджа: 174x174px
      const badgeSize = 209;
      // Позиция согласно указанным отступам:
      // От верха: 162px, от правой границы: 192px
      const y = 182;
      const x = 1000 - 192 - badgeSize; // 1000 - 192 - 174 = 634

      const rareBadgeImg = new Image();
      rareBadgeImg.crossOrigin = 'anonymous';
      rareBadgeImg.onload = () => {
        ctx.drawImage(rareBadgeImg, x, y, badgeSize, badgeSize);
        resolve();
      };
      rareBadgeImg.onerror = () => {
        console.error('Failed to load rare badge image');
        resolve();
      };
      rareBadgeImg.src = rareBadge;
    });
  };

  const handleExportPNG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Use the current canvas which already has everything rendered
    downloadCanvas(canvas);
  };

  const downloadCanvas = (canvas: HTMLCanvasElement) => {
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cover-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
  };

  const handleClear = () => {
    setSelectedCountry('');
    setSelectedFlavor('');
    setSelectedDripFlavors([]);
    setIsRareLot(false);
  };

  const handleDripFlavorToggle = (flavorName: string) => {
    setSelectedDripFlavors(prev => {
      if (prev.includes(flavorName)) {
        return prev.filter(f => f !== flavorName);
      } else if (prev.length < 5) {
        return [...prev, flavorName];
      }
      return prev;
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Конструктор обложек товаров</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Создавайте обложки с бейджами на базовом изображении (PNG 1000x1000px)
          </p>
        </div>
        <Button onClick={handleExportPNG} className="flex items-center gap-2">
          <Download className="w-4 h-4" />
          Экспорт PNG
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Preview Panel */}
        <Card className="p-6">
          <h3 className="text-lg font-medium mb-4">Превью обложки</h3>
          <div 
            ref={previewRef}
            className="relative w-full aspect-square bg-[#FFF4E5] rounded-lg overflow-hidden border-2 border-border"
            style={{ maxWidth: '500px', margin: '0 auto' }}
          >
            {/* Base Image */}
            <img 
              src={activeCoverSrc} 
              alt="Base cover" 
              className="absolute inset-0 w-full h-full object-cover"
            />
            
            {/* Badges overlay - точные стили из дизайна */}
            {productType === 'coffee' && (selectedCountry || selectedFlavor) && (
              <div className="absolute left-0 right-0 flex justify-center items-center" style={{ top: '15px', gap: '3.8px' }}>
                {selectedCountry && (
                  <div
                    className="flex items-center justify-center text-black whitespace-nowrap"
                    style={{
                      backgroundColor: COUNTRIES.find(c => c.name === selectedCountry)?.color,
                      height: '39.92px',
                      padding: '0 14px',
                      fontFamily: '"Mabry Mono Pro", "Mabry Pro", monospace',
                      fontSize: '26.57px',
                      fontWeight: 200,
                      lineHeight: '22.06px',
                      letterSpacing: '-0.5px',
                    }}
                  >
                    {selectedCountry}
                  </div>
                )}
                {selectedFlavor && (
                  <div
                    className="flex items-center justify-center text-black whitespace-nowrap"
                    style={{
                      backgroundColor: FLAVORS.find(f => f.name === selectedFlavor)?.color,
                      height: '39.92px',
                      padding: '0 14px',
                      fontFamily: '"Mabry Mono Pro", "Mabry Pro", monospace',
                      fontSize: '26.57px',
                      fontWeight: 200,
                      lineHeight: '22.06px',
                      letterSpacing: '-0.5px',
                    }}
                  >
                    {selectedFlavor}
                  </div>
                )}
              </div>
            )}

            {/* Drip Flavors - 2 rows */}
            {isDripMode && selectedDripFlavors.length > 0 && (
              <div className="absolute left-0 right-0" style={{ top: '15px' }}>
                {/* First row - 3 flavors */}
                <div className="flex justify-center items-center" style={{ gap: '3.8px' }}>
                  {selectedDripFlavors.slice(0, 3).map(name => (
                    <div
                      key={name}
                      className="flex items-center justify-center text-black whitespace-nowrap"
                      style={{
                        backgroundColor: FLAVORS.find(f => f.name === name)?.color,
                        height: '39.92px',
                        padding: '0 14px',
                        fontFamily: '"Mabry Mono Pro", "Mabry Pro", monospace',
                        fontSize: '26.57px',
                        fontWeight: 200,
                        lineHeight: '22.06px',
                        letterSpacing: '-0.5px',
                      }}
                    >
                      {name}
                    </div>
                  ))}
                </div>
                
                {/* Second row - 2 flavors */}
                {selectedDripFlavors.length > 3 && (
                  <div className="flex justify-center items-center" style={{ gap: '3.8px', marginTop: '3.8px' }}>
                    {selectedDripFlavors.slice(3, 5).map(name => (
                      <div
                        key={name}
                        className="flex items-center justify-center text-black whitespace-nowrap"
                        style={{
                          backgroundColor: FLAVORS.find(f => f.name === name)?.color,
                          height: '39.92px',
                          padding: '0 14px',
                          fontFamily: '"Mabry Mono Pro", "Mabry Pro", monospace',
                          fontSize: '26.57px',
                          fontWeight: 200,
                          lineHeight: '22.06px',
                          letterSpacing: '-0.5px',
                        }}
                      >
                        {name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Rare Lot Badge - Only for Coffee */}
            {isRareLot && productType === 'coffee' && (
              <img 
                src={rareBadge}
                alt="Редкий лот"
                className="absolute"
                style={{
                  width: '104px',
                  height: '104px',
                  right: '72px',
                  top: '67px',
                }}
              />
            )}
          </div>
          
          {/* Hidden canvas for export */}
          <canvas ref={canvasRef} className="hidden" />
        </Card>

        {/* Controls Panel */}
        <Card className="p-6">
          <h3 className="text-lg font-medium mb-4">Управление бейджами</h3>
          
          <div className="space-y-6">
            {/* Product Type Tabs */}
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-gray-100 rounded-lg">
              <button
                type="button"
                onClick={() => {
                  setProductType('coffee');
                  setSelectedDripFlavors([]);
                }}
                className={`px-2 py-2 rounded-md text-sm font-medium transition-all ${
                  productType === 'coffee'
                    ? 'bg-white text-black shadow-sm'
                    : 'text-gray-600 hover:text-black'
                }`}
              >
                Кофе
              </button>
              <button
                type="button"
                onClick={() => {
                  setProductType('drip6');
                  setSelectedCountry('');
                  setSelectedFlavor('');
                  setIsRareLot(false);
                }}
                className={`px-2 py-2 rounded-md text-sm font-medium transition-all ${
                  productType === 'drip6'
                    ? 'bg-white text-black shadow-sm'
                    : 'text-gray-600 hover:text-black'
                }`}
              >
                Дрипы (6)
              </button>
              <button
                type="button"
                onClick={() => {
                  setProductType('drip10');
                  setSelectedCountry('');
                  setSelectedFlavor('');
                  setIsRareLot(false);
                }}
                className={`px-2 py-2 rounded-md text-sm font-medium transition-all ${
                  productType === 'drip10'
                    ? 'bg-white text-black shadow-sm'
                    : 'text-gray-600 hover:text-black'
                }`}
              >
                Дрипы (10)
              </button>
            </div>

            {/* Country Selection - Only for Coffee */}
            {productType === 'coffee' && (
              <div>
                <label className="text-sm font-medium mb-2 block">Страна</label>
                <div className="grid grid-cols-2 gap-2">
                  {COUNTRIES.map(country => (
                    <button
                      key={country.name}
                      onClick={() => setSelectedCountry(
                        selectedCountry === country.name ? '' : country.name
                      )}
                      className={`px-4 py-2 rounded font-bold text-black transition-all border-2 ${
                        selectedCountry === country.name 
                          ? 'border-pink-500 scale-105' 
                          : 'border-transparent hover:scale-102'
                      }`}
                      style={{ backgroundColor: country.color }}
                    >
                      {country.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Flavor Selection */}
            <div>
              <label className="text-sm font-medium mb-2 block">
                Вкус{isDripMode && ` (${selectedDripFlavors.length}/5)`}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {FLAVORS.map(flavor => (
                  <button
                    key={flavor.name}
                    onClick={() => {
                      if (productType === 'coffee') {
                        setSelectedFlavor(selectedFlavor === flavor.name ? '' : flavor.name);
                      } else {
                        handleDripFlavorToggle(flavor.name);
                      }
                    }}
                    className={`px-4 py-2 rounded font-bold text-black transition-all border-2 ${
                      (productType === 'coffee' && selectedFlavor === flavor.name) ||
                      (isDripMode && selectedDripFlavors.includes(flavor.name))
                        ? 'border-pink-500 scale-105' 
                        : 'border-transparent hover:scale-102'
                    }`}
                    style={{ backgroundColor: flavor.color }}
                  >
                    {flavor.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Rare Lot Toggle - Only for Coffee */}
            {productType === 'coffee' && (
              <div className="flex items-center justify-between p-4 bg-gray-100 rounded-lg border-2 border-border">
                <div className="flex flex-col">
                  <Label htmlFor="rare-lot" className="text-sm font-medium cursor-pointer">
                    Редкий лот
                  </Label>
                  <span className="text-xs text-muted-foreground">
                    Добавить круглый бейдж
                  </span>
                </div>
                <Switch 
                  id="rare-lot"
                  checked={isRareLot}
                  onCheckedChange={setIsRareLot}
                />
              </div>
            )}

            {/* Clear button */}
            {(selectedCountry || selectedFlavor || selectedDripFlavors.length > 0 || isRareLot) && (
              <Button 
                onClick={handleClear}
                variant="outline"
                className="w-full flex items-center justify-center gap-2"
              >
                <X className="w-4 h-4" />
                Очистить бейджи
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}