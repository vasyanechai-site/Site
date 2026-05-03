> **Сводка по проекту (май 2026):** данные и заказы — **Node API** (`server/`), фронт в проде — только **`dist/`** после `npm run build` (в `index.html` — скрипты `/assets/*.js`, не `/src/main.tsx`, иначе «белый экран»). Актуальные инструкции: в корне **`README.md`**, **`НАЧАЛО-БЕЗ-КОДА.md`**, **`ПРОДАКШН-100-ПРОЦЕНТОВ.md`**, **`DEPLOY_REGRU.md`**; быстрый старт во фронте — **`src/app/START_HERE.md`**.
>
> _Ниже — архивная или тематическая заметка; шаги, где основной бэкенд описан только как Supabase Edge без Node, для текущего продакшена могут быть неполными._

# Обновлена стилизация выпадающих элементов для розницы

## Изменения
Все выпадающие элементы (Select, Popover, DropdownMenu) на сайте розницы теперь имеют фон **#FFF4E5** вместо белого, и обновленный цвет ховера **#FFE5CC** вместо серого.

## Затронутые компоненты UI

### 1. `/components/ui/select.tsx`

#### SelectContent
- **Было**: `bg-popover` (белый фон)
- **Стало**: `bg-[#FFF4E5]` (бежевый фон сайта)

#### SelectItem (ховер)
- **Было**: `focus:bg-accent focus:text-accent-foreground` (серый ховер)
- **Стало**: `focus:bg-[#FFE5CC] focus:text-[#222222]` (теплый персиковый ховер)

### 2. `/components/ui/popover.tsx`

#### PopoverContent
- **Было**: `bg-popover` (белый фон)
- **Стало**: `bg-[#FFF4E5]` (бежевый фон сайта)

### 3. `/components/ui/dropdown-menu.tsx`

#### DropdownMenuContent
- **Было**: `bg-popover` (белый фон)
- **Стало**: `bg-[#FFF4E5]` (бежевый фон сайта)

#### DropdownMenuItem (ховер)
- **Было**: `focus:bg-accent focus:text-accent-foreground` (серый ховер)
- **Стало**: `focus:bg-[#FFE5CC] focus:text-[#222222]` (теплый персиковый ховер)

#### DropdownMenuCheckboxItem (ховер)
- **Было**: `focus:bg-accent focus:text-accent-foreground` (серый ховер)
- **Стало**: `focus:bg-[#FFE5CC] focus:text-[#222222]` (теплый персиковый ховер)

#### DropdownMenuRadioItem (ховер)
- **Было**: `focus:bg-accent focus:text-accent-foreground` (серый ховер)
- **Стало**: `focus:bg-[#FFE5CC] focus:text-[#222222]` (теплый персиковый ховер)

#### DropdownMenuSubTrigger (ховер)
- **Было**: `focus:bg-accent focus:text-accent-foreground` + `data-[state=open]:bg-accent` (серый)
- **Стало**: `focus:bg-[#FFE5CC] focus:text-[#222222]` + `data-[state=open]:bg-[#FFE5CC]` (персиковый)

#### DropdownMenuSubContent
- **Было**: `bg-popover` (белый фон)
- **Стало**: `bg-[#FFF4E5]` (бежевый фон сайта)

## Цветовая схема

### Основной фон выпадающих списков
- **Цвет**: `#FFF4E5`
- **Описание**: Бежевый фон, соответствующий основному фону сайта розницы

### Ховер/Фокус элементов
- **Цвет**: `#FFE5CC`
- **Описание**: Теплый персиковый оттенок, гармонирующий с общей палитрой сайта
- **Текст**: `#222222` (темный текст для контраста)

## Где применяется

### Страница товара (`/components/RetailProductDetail.tsx`)
- Выбор веса (200гр, 500гр, 1кг)
- Выбор обжарки (Фильтр, Эспрессо)
- Выбор помола (В зернах, Турка, Френч-пресс и т.д.)

### Любые другие места где используются:
- `Select` компоненты
- `Popover` компоненты
- `DropdownMenu` компоненты

## Результат
Теперь все выпадающие списки имеют единообразный дизайн, соответствующий фирменному стилю магазина с бежевыми тонами (#FFF4E5) и розовыми акцентами.
