import React, { useState } from 'react';
import { useNavigate } from 'react-router@7.12.0';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, ChevronDown, Mountain, Droplets } from 'lucide-react';
import { RetailHeader } from './RetailHeader';
import { RetailMobileTabBar } from './RetailMobileTabBar';

// ─── DATA ────────────────────────────────────────────────────────────────────

type Region = 'Америка' | 'Африка' | 'Азия и Океания' | 'Ближний Восток';

interface CountryData {
  id: string;
  name: string;
  nameEn: string;
  flag: string;
  region: Region;
  harvest: number[];
  export: number[];
  altitude?: string;
  varieties?: string;
  notes?: string;
  color: string;
}

const COUNTRIES: CountryData[] = [
  {
    id: 'brazil',
    name: 'Бразилия',
    nameEn: 'Brazil',
    flag: '🇧🇷',
    region: 'Америка',
    harvest: [3, 4, 5, 6, 7, 8],
    export: [6, 7, 8, 9, 10, 11, 0, 1, 2],
    altitude: '500–1200 м',
    varieties: 'Bourbon, Typica, Catuai',
    notes: 'Крупнейший производитель кофе в мире. Натуральная и хани обработка.',
    color: '#4CAF50',
  },
  {
    id: 'colombia',
    name: 'Колумбия',
    nameEn: 'Colombia',
    flag: '🇨🇴',
    region: 'Америка',
    harvest: [9, 10, 11, 0, 1, 3, 4, 5],
    export: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    altitude: '1200–2000 м',
    varieties: 'Caturra, Castillo, Colombia',
    notes: 'Два урожая в год: основной и «митака». Мытая обработка.',
    color: '#82A87A',
  },
  {
    id: 'guatemala',
    name: 'Гватемала',
    nameEn: 'Guatemala',
    flag: '🇬🇹',
    region: 'Америка',
    harvest: [9, 10, 11, 0, 1, 2],
    export: [0, 1, 2, 3, 4, 5, 6],
    altitude: '1200–2000 м',
    varieties: 'Bourbon, Caturra, Typica',
    notes: 'Вулканические почвы придают кофе шоколадный характер.',
    color: '#8BC34A',
  },
  {
    id: 'honduras',
    name: 'Гондурас',
    nameEn: 'Honduras',
    flag: '🇭🇳',
    region: 'Америка',
    harvest: [10, 11, 0, 1, 2],
    export: [11, 0, 1, 2, 3, 4],
    altitude: '1000–1800 м',
    varieties: 'Catuai, Lempira, Ihcafe 90',
    notes: 'Быстро растущий экспортёр. Преимущественно мытая обработка.',
    color: '#2196F3',
  },
  {
    id: 'costa-rica',
    name: 'Коста-Рика',
    nameEn: 'Costa Rica',
    flag: '🇨🇷',
    region: 'Америка',
    harvest: [9, 10, 11, 0, 1],
    export: [1, 2, 3, 4, 5, 6],
    altitude: '1200–1700 м',
    varieties: 'Catuai, Villa Sarchi, Gesha',
    notes: 'Известна технологией honey processing. Высокие стандарты качества.',
    color: '#E91E63',
  },
  {
    id: 'el-salvador',
    name: 'Эль-Сальвадор',
    nameEn: 'El Salvador',
    flag: '🇸🇻',
    region: 'Америка',
    harvest: [10, 11, 0, 1, 2],
    export: [0, 1, 2, 3, 4, 5],
    altitude: '500–1500 м',
    varieties: 'Bourbon, Pacamara',
    notes: 'Ценится за сорт Pacamara с уникальными цитрусовыми нотами.',
    color: '#9C27B0',
  },
  {
    id: 'nicaragua',
    name: 'Никарагуа',
    nameEn: 'Nicaragua',
    flag: '🇳🇮',
    region: 'Америка',
    harvest: [10, 11, 0, 1, 2],
    export: [0, 1, 2, 3, 4],
    altitude: '700–1500 м',
    varieties: 'Caturra, Catuai, Maragogype',
    notes: 'Мягкий климат даёт сбалансированный, ореховый кофе.',
    color: '#00BCD4',
  },
  {
    id: 'mexico',
    name: 'Мексика',
    nameEn: 'Mexico',
    flag: '🇲🇽',
    region: 'Америка',
    harvest: [10, 11, 0, 1, 2],
    export: [0, 1, 2, 3, 4, 5],
    altitude: '900–1800 м',
    varieties: 'Typica, Bourbon, Maragogype',
    notes: 'Регионы: Чьяпас, Оахака, Веракрус. Популярен органический кофе.',
    color: '#FF5722',
  },
  {
    id: 'peru',
    name: 'Перу',
    nameEn: 'Peru',
    flag: '🇵🇪',
    region: 'Америка',
    harvest: [3, 4, 5, 6, 7, 8],
    export: [5, 6, 7, 8, 9, 10, 11],
    altitude: '1500–2000 м',
    varieties: 'Caturra, Bourbon, Typica',
    notes: 'Выращивается в андских регионах. Большой выбор органических сортов.',
    color: '#795548',
  },
  {
    id: 'ethiopia',
    name: 'Эфиопия',
    nameEn: 'Ethiopia',
    flag: '🇪🇹',
    region: 'Африка',
    harvest: [9, 10, 11, 0],
    export: [10, 11, 0, 1, 2, 3, 4],
    altitude: '1500–2200 м',
    varieties: 'Heirloom',
    notes: 'Родина кофе. Иргачеффе, Сидамо, Харар — знаменитые регионы.',
    color: '#FF6B35',
  },
  {
    id: 'kenya',
    name: 'Кения',
    nameEn: 'Kenya',
    flag: '🇰🇪',
    region: 'Африка',
    harvest: [9, 10, 11, 5, 6],
    export: [10, 11, 0, 1, 2, 3],
    altitude: '1400–2000 м',
    varieties: 'SL28, SL34, Ruiru 11',
    notes: 'Два урожая в год. AA — высший сорт. Яркая ягодная кислотность.',
    color: '#F44336',
  },
  {
    id: 'tanzania',
    name: 'Танзания',
    nameEn: 'Tanzania',
    flag: '🇹🇿',
    region: 'Африка',
    harvest: [6, 7, 8, 9],
    export: [9, 10, 11, 0, 1, 2],
    altitude: '1400–1800 м',
    varieties: 'Bourbon, Typica, Kent',
    notes: 'Районы Килиманджаро и Мбея. Мытая обработка, яркая кислотность.',
    color: '#3F51B5',
  },
  {
    id: 'rwanda',
    name: 'Руанда',
    nameEn: 'Rwanda',
    flag: '🇷🇼',
    region: 'Африка',
    harvest: [1, 2, 3, 4, 5],
    export: [3, 4, 5, 6, 7, 8],
    altitude: '1500–2000 м',
    varieties: 'Bourbon',
    notes: 'Страна тысячи холмов. Бурбон с флоральными и ягодными нотами.',
    color: '#009688',
  },
  {
    id: 'uganda',
    name: 'Уганда',
    nameEn: 'Uganda',
    flag: '🇺🇬',
    region: 'Африка',
    harvest: [10, 11, 0, 1, 4, 5, 6],
    export: [10, 11, 0, 1, 2, 3],
    altitude: '1200–2200 м',
    varieties: 'Robusta, SL14, SL28',
    notes: 'Арабика с горы Элгон особо ценится. Также крупный производитель робусты.',
    color: '#FFCA28',
  },
  {
    id: 'burundi',
    name: 'Бурунди',
    nameEn: 'Burundi',
    flag: '🇧🇮',
    region: 'Африка',
    harvest: [2, 3, 4, 5],
    export: [4, 5, 6, 7, 8],
    altitude: '1200–2000 м',
    varieties: 'Bourbon',
    notes: 'Схож с Руандой. «Potato defect» — особая черта. Яркий и сочный.',
    color: '#FF4081',
  },
  {
    id: 'indonesia-sumatra',
    name: 'Индонезия (Суматра)',
    nameEn: 'Indonesia (Sumatra)',
    flag: '🇮🇩',
    region: 'Азия и Океания',
    harvest: [9, 10, 11, 0, 1, 2],
    export: [11, 0, 1, 2, 3, 4],
    altitude: '700–1500 м',
    varieties: 'Typica, Tim Tim',
    notes: 'Wet-hulled (Giling Basah) обработка. Землистые, травяные ноты.',
    color: '#8D6E63',
  },
  {
    id: 'vietnam',
    name: 'Вьетнам',
    nameEn: 'Vietnam',
    flag: '🇻🇳',
    region: 'Азия и Океания',
    harvest: [9, 10, 11, 0, 1],
    export: [10, 11, 0, 1, 2, 3],
    altitude: '500–1500 м',
    varieties: 'Robusta (95%), Arabica',
    notes: 'Второй по объёму экспортёр в мире. Плантации Dalat.',
    color: '#E53935',
  },
  {
    id: 'india',
    name: 'Индия',
    nameEn: 'India',
    flag: '🇮🇳',
    region: 'Азия и Океания',
    harvest: [10, 11, 0, 1],
    export: [0, 1, 2, 3, 4, 5, 6],
    altitude: '600–1600 м',
    varieties: 'Arabica, Robusta',
    notes: 'Монсунный Малабар — уникальный стиль обработки.',
    color: '#FF9800',
  },
  {
    id: 'papua-new-guinea',
    name: 'Папуа — Нов. Гвинея',
    nameEn: 'Papua New Guinea',
    flag: '🇵🇬',
    region: 'Азия и Океания',
    harvest: [3, 4, 5, 6, 7, 8],
    export: [5, 6, 7, 8, 9, 10],
    altitude: '1200–1800 м',
    varieties: 'Arusha, Typica, Bourbon',
    notes: 'Сбор в традиционных деревенских хозяйствах. Фруктовые ноты.',
    color: '#7B1FA2',
  },
  {
    id: 'yemen',
    name: 'Йемен',
    nameEn: 'Yemen',
    flag: '🇾🇪',
    region: 'Ближний Восток',
    harvest: [9, 10, 11],
    export: [11, 0, 1, 2],
    altitude: '1500–2500 м',
    varieties: 'Heirloom',
    notes: 'Древнейшая история кофе. Натуральная обработка. Редкий и ценный.',
    color: '#FF6F00',
  },
];

const MONTHS = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];

// ─── UTILS ───────────────────────────────────────────────────────────────────

function getStatusForMonth(country: CountryData, monthIdx: number) {
  const isHarvest = country.harvest.includes(monthIdx);
  const isExport = country.export.includes(monthIdx);
  if (isHarvest && isExport) return 'active-both';
  if (isHarvest) return 'harvest';
  if (isExport) return 'export';
  return 'inactive';
}

function getSeasonStatusText(country: CountryData, monthIdx: number) {
  const status = getStatusForMonth(country, monthIdx);
  if (status === 'active-both') return 'Сбор и экспорт';
  if (status === 'harvest') return 'Сбор урожая';
  if (status === 'export') return 'Экспорт';
  return 'Несезон';
}

// ─── MAIN PAGE ───────────────────────────────────────────────────────────────

export function HarvestCalendarPage() {
  const navigate = useNavigate();
  const currentMonth = new Date().getMonth();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggle = (id: string) =>
    setExpandedId(prev => (prev === id ? null : id));

  return (
    <div className="min-h-screen bg-[#FFF4E5] pb-24">
      <RetailHeader
        cartItemsCount={0}
        onNavigateToLogin={() => navigate('/login')}
        onOpenFavorites={() => navigate('/')}
        onOpenCart={() => navigate('/')}
      />

      {/* Sticky page header — sits BELOW the RetailHeader (mobile: 64px, desktop: 72px) */}
      <div className="sticky top-16 sm:top-[72px] z-40 bg-[#FFF4E5]/95 backdrop-blur-xl border-b border-[#222222]/10 px-4 sm:px-6 h-12 flex items-center">
        <div className="max-w-4xl w-full mx-auto relative flex items-center">
          {/* Back button — left */}
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 text-[#222222]/50 hover:text-[#222222] transition-colors text-sm font-medium z-10"
          >
            <ArrowLeft className="w-4 h-4" />
            Назад
          </button>
          {/* Title — absolutely centred in full width */}
          <h1 className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 text-base font-bold text-[#222222] whitespace-nowrap pointer-events-none">
            Календарь кофе
          </h1>
        </div>
      </div>

      {/* Calendar card */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 mt-6">

        {/* ── Legend (top of card) ── */}
        <div className="bg-[#FFF4E5] rounded-t-2xl border border-b-0 border-[#222222]/10 px-4 pt-4 pb-3 flex flex-wrap gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#82A87A]" />
            <span className="text-[#222222]/70">Сбор урожая</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#FF90A1]" />
            <span className="text-[#222222]/70">Экспорт</span>
          </div>
        </div>

        {/* ── Sticky month labels — lives OUTSIDE overflow container ── */}
        <div className="sticky top-[112px] sm:top-[120px] z-20 bg-[#FFF4E5]/95 backdrop-blur-sm border border-b-0 border-[#222222]/10 px-4 py-2 flex items-center gap-2">
          <div className="w-[120px] sm:w-[160px] shrink-0" />
          <div className="flex flex-1 gap-[2px]">
            {MONTHS.map((m, i) => (
              <div
                key={m}
                className={`flex-1 text-center text-[9px] font-bold leading-none ${
                  i === currentMonth ? 'text-[#FF90A1]' : 'text-[#222222]/30'
                }`}
              >
                <span className="sm:hidden">{m[0]}</span>
                <span className="hidden sm:inline">{m}</span>
              </div>
            ))}
          </div>
          <div className="w-5 shrink-0" />
        </div>

        {/* ── Country rows (overflow:clip safe — no sticky children here) ── */}
        <div className="bg-[#FFF4E5] rounded-b-2xl border border-[#222222]/10 overflow-hidden">
          {COUNTRIES.map((country, idx) => {
            const isExpanded = expandedId === country.id;
            const isLast = idx === COUNTRIES.length - 1;

            return (
              <div
                key={country.id}
                className={`${!isLast || isExpanded ? 'border-b border-[#222222]/10' : ''}`}
              >
                {/* Clickable row */}
                <div
                  onClick={() => toggle(country.id)}
                  className={`flex items-center gap-2 px-4 py-3 cursor-pointer transition-colors ${
                    isExpanded ? 'bg-[#222222]/5' : 'hover:bg-[#222222]/5'
                  }`}
                >
                  {/* Flag + name */}
                  <div className="w-[120px] sm:w-[160px] shrink-0 flex items-center gap-2 min-w-0">
                    <span className="text-lg leading-none shrink-0">{country.flag}</span>
                    <span className="text-sm font-medium text-[#222222] truncate leading-tight">
                      {country.name}
                    </span>
                  </div>

                  {/* Month bars */}
                  <div className="flex flex-1 gap-[2px]">
                    {MONTHS.map((_, i) => {
                      const isHarvest = country.harvest.includes(i);
                      const isExport  = country.export.includes(i);
                      const isCurrent = i === currentMonth;
                      const bg =
                        isHarvest && isExport
                          ? 'linear-gradient(to bottom, #82A87A 50%, #FF90A1 50%)'
                          : isHarvest
                          ? '#82A87A'
                          : isExport
                          ? '#FF90A1'
                          : '#EBDAC3';
                      return (
                        <div
                          key={i}
                          className={`flex-1 h-[14px] rounded-[2px] ${isCurrent ? 'ring-1 ring-inset ring-[#222222]/30' : ''}`}
                          style={{ background: bg }}
                        />
                      );
                    })}
                  </div>

                  {/* Chevron */}
                  <div className="w-5 shrink-0 flex justify-end">
                    <motion.div
                      animate={{ rotate: isExpanded ? 180 : 0 }}
                      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                    >
                      <ChevronDown className="w-3.5 h-3.5 text-[#222222]/30" />
                    </motion.div>
                  </div>
                </div>

                {/* Expanded detail */}
                <AnimatePresence>
                  {isExpanded && (
                    <ExpandedDetail
                      key={country.id}
                      country={country}
                      currentMonth={currentMonth}
                    />
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

      </div>

      <RetailMobileTabBar
        currentTab="harvest"
        onTabSelect={(tab) => {
          if (tab === 'home')      navigate('/');
          if (tab === 'cart')      navigate('/?action=cart');
          if (tab === 'favorites') navigate('/?action=favorites');
          if (tab === 'locations') navigate('/locations');
          if (tab === 'profile')   navigate('/dashboard');
        }}
        cartItemsCount={0}
        favoritesCount={0}
      />
    </div>
  );
}

// ─── EXPANDED DETAIL ─────────────────────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0, height: 0 },
  visible: {
    opacity: 1,
    height: 'auto',
    transition: {
      height: { duration: 0.35, ease: [0.4, 0, 0.2, 1] },
      opacity: { duration: 0.2, delay: 0.05 },
      staggerChildren: 0.07,
      delayChildren: 0.1,
    },
  },
  exit: {
    opacity: 0,
    height: 0,
    transition: {
      height: { duration: 0.25, ease: [0.4, 0, 0.2, 1] },
      opacity: { duration: 0.15 },
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] } },
  exit: { opacity: 0, y: 6, transition: { duration: 0.15 } },
};

const barVariants = {
  hidden: { scaleY: 0, opacity: 0 },
  visible: (i: number) => ({
    scaleY: 1,
    opacity: 1,
    transition: { delay: i * 0.03, duration: 0.3, ease: [0.4, 0, 0.2, 1] },
  }),
};

function ExpandedDetail({
  country,
  currentMonth,
}: {
  country: CountryData;
  currentMonth: number;
}) {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="bg-[#FFF4E5] border-t border-[#222222]/10 overflow-hidden"
    >
      <div className="p-5 space-y-5">

        {/* Header */}
        <motion.div variants={itemVariants} className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <motion.span
              className="text-3xl"
              initial={{ scale: 0.5, rotate: -15, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              transition={{ delay: 0.15, duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
            >
              {country.flag}
            </motion.span>
            <div className="font-bold text-[#222222] text-base">{country.name}</div>
          </div>
          {/* Legend — top right, same style as table header legend */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#82A87A]" />
              <span className="text-[#222222]/70 text-xs">Сбор урожая</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#FF90A1]" />
              <span className="text-[#222222]/70 text-xs">Экспорт</span>
            </div>
          </div>
        </motion.div>

        {/* Seasonality bars */}
        <motion.div variants={itemVariants}>
          <h4 className="text-xs font-bold text-[#222222]/40 uppercase tracking-widest mb-3">
            Сезонность
          </h4>
          <div className="grid grid-cols-12 gap-0.5 mb-1">
            {MONTHS.map((m, i) => {
              const isHarvest = country.harvest.includes(i);
              const isExport  = country.export.includes(i);
              const isCurrent = i === currentMonth;
              const bg =
                isHarvest && isExport
                  ? 'linear-gradient(to bottom, #82A87A 50%, #FF90A1 50%)'
                  : isHarvest
                  ? '#82A87A'
                  : isExport
                  ? '#FF90A1'
                  : '#EBDAC3';
              return (
                <div key={m} className="flex flex-col items-center">
                  <motion.div
                    custom={i}
                    variants={barVariants}
                    style={{ background: bg, originY: 1 }}
                    className={`w-full h-9 rounded-md ${isCurrent ? 'ring-2 ring-[#222222] scale-105 z-10' : ''}`}
                  />
                  <motion.span
                    className={`text-[9px] font-medium mt-1 ${isCurrent ? 'text-[#222222]' : 'text-[#222222]/30'}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.15 + i * 0.03 }}
                  >
                    <span className="sm:hidden">{m[0]}</span>
                    <span className="hidden sm:inline">{m}</span>
                  </motion.span>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Info grid */}
        <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <motion.div
            className="rounded-xl p-3 border border-[#222222]/10"
            whileHover={{ scale: 1.02, transition: { duration: 0.15 } }}
          >
            <div className="flex items-center gap-2 mb-1">
              <Mountain className="w-3.5 h-3.5 text-[#FF90A1]" />
              <span className="text-xs font-semibold text-[#222222]/60 uppercase tracking-wider">Высота</span>
            </div>
            <p className="text-sm font-medium text-[#222222]">{country.altitude || 'Нет данных'}</p>
          </motion.div>
          <motion.div
            className="rounded-xl p-3 border border-[#222222]/10"
            whileHover={{ scale: 1.02, transition: { duration: 0.15 } }}
          >
            <div className="flex items-center gap-2 mb-1">
              <Droplets className="w-3.5 h-3.5 text-[#FF90A1]" />
              <span className="text-xs font-semibold text-[#222222]/60 uppercase tracking-wider">Обработка / Сорта</span>
            </div>
            <p className="text-sm font-medium text-[#222222]">{country.varieties || 'Нет данных'}</p>
          </motion.div>
        </motion.div>

      </div>
    </motion.div>
  );
}