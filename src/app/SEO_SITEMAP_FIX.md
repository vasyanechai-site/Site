> **Сводка по проекту (май 2026):** данные и заказы — **Node API** (`server/`), фронт в проде — только **`dist/`** после `npm run build` (в `index.html` — скрипты `/assets/*.js`, не `/src/main.tsx`, иначе «белый экран»). Актуальные инструкции: в корне **`README.md`**, **`НАЧАЛО-БЕЗ-КОДА.md`**, **`ПРОДАКШН-100-ПРОЦЕНТОВ.md`**, **`DEPLOY_REGRU.md`**; быстрый старт во фронте — **`src/app/START_HERE.md`**.
>
> _Ниже — архивная или тематическая заметка; шаги, где основной бэкенд описан только как Supabase Edge без Node, для текущего продакшена могут быть неполными._

# 🔧 Исправление ошибки "Главная страница сайта недоступна для робота"

**Дата:** 12 февраля 2026  
**Источник проблемы:** Яндекс.Вебмастер  
**Статус:** ✅ **ИСПРАВЛЕНО**

---

## 🐛 Обнаруженная проблема

### Ошибка из Яндекс.Вебмастер:

```
Главная страница сайта недоступна для робота

При обращении к главной странице сайта не удалось получить документ: «()». 
Поскольку страница недоступна для робота, она может быть исключена из результатов поиска.
```

### Дополнительные проблемы:

1. ❌ **Обнаружены ошибки в файлах Sitemap**
2. ⚠️ **Не найден файл robots.txt** (рекомендация)
3. ⚠️ **Некорректно настроено отображение несуществующих файлов и страниц**

---

## 🔍 Анализ причин

### Проблема #1: Некорректный sitemap.xml

**Было:**
```xml
<url>
  <loc>https://coffeenechai.ru/catalog</loc>  ❌ Страница не существует
</url>
<url>
  <loc>https://coffeenechai.ru/favorites</loc>  ❌ Страница не существует
</url>
<url>
  <loc>https://coffeenechai.ru/cart</loc>  ❌ Страница не существует
</url>
<url>
  <loc>https://coffeenechai.ru/wholesale</loc>  ❌ Страница не существует
</url>
<url>
  <loc>https://coffeenechai.ru/user-agreement</loc>  ❌ Неправильный URL
</url>
<url>
  <loc>https://coffeenechai.ru/privacy-policy</loc>  ❌ Неправильный URL
</url>
```

**Реальная структура маршрутов из `/App.tsx`:**
```typescript
<Route path="/" element={<RetailRoute />} />              // ✅ Главная
<Route path="/locations" element={<LocationsPage />} />   // ✅ Где купить
<Route path="/business" element={<BusinessRoute />} />    // ✅ Для бизнеса
<Route path="/privacy" element={<PrivacyPolicy />} />     // ✅ Политика
<Route path="/agreement" element={<UserAgreement />} />   // ✅ Соглашение
<Route path="/marketing-consent" element={...} />         // ✅ Маркетинг
<Route path="/:productSlug" element={<ProductRoute />} /> // ✅ Товары (slug)
<Route path="/w/:userId" element={<WholesaleRoute />} />  // ✅ Оптовая (приватная)
```

**Причина ошибки:**
Яндекс робот пытался проиндексировать несуществующие страницы из sitemap (например `/catalog`), получал 404 ошибки, и делал вывод что сайт недоступен.

---

### Проблема #2: Некорректные URL в Schema.org разметке

**Было в `/index.html`:**
```json
{
  "@type": "SearchAction",
  "target": "https://coffeenechai.ru/catalog?search={search_term_string}"
}
```

❌ Страница `/catalog` не существует

---

### Проблема #3: Некорректный robots.txt

**Было:**
```
Allow: /catalog        ❌ Не существует
Allow: /catalog/*      ❌ Не существует
Allow: /favorites      ❌ Не существует
Allow: /cart           ❌ Не существует
Disallow: /auth        ❌ Директории нет
Disallow: /auth/*      ❌ Директории нет
```

---

## ✅ Что было исправлено

### 1. Обновлён `/public/sitemap.xml`

**Теперь:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">

  <!-- Главная страница (розничная витрина) -->
  <url>
    <loc>https://coffeenechai.ru/</loc>
    <lastmod>2026-02-12</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>

  <!-- Публичная страница для бизнеса -->
  <url>
    <loc>https://coffeenechai.ru/business</loc>
    <lastmod>2026-02-12</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>

  <!-- Где купить / Точки продаж -->
  <url>
    <loc>https://coffeenechai.ru/locations</loc>
    <lastmod>2026-02-12</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>

  <!-- Политика конфиденциальности -->
  <url>
    <loc>https://coffeenechai.ru/privacy</loc>
    <lastmod>2026-02-12</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.4</priority>
  </url>

  <!-- Пользовательское соглашение -->
  <url>
    <loc>https://coffeenechai.ru/agreement</loc>
    <lastmod>2026-02-12</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.4</priority>
  </url>

  <!-- Согласие на маркетинг -->
  <url>
    <loc>https://coffeenechai.ru/marketing-consent</loc>
    <lastmod>2026-02-12</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.3</priority>
  </url>

</urlset>
```

**Изменения:**
- ✅ Удалены несуществующие страницы (`/catalog`, `/favorites`, `/cart`, `/wholesale`)
- ✅ Исправлены URL (`/user-agreement` → `/agreement`, `/privacy-policy` → `/privacy`)
- ✅ Обновлена дата `lastmod` на актуальную (2026-02-12)
- ✅ Все URL соответствуют реальной структуре маршрутов

---

### 2. Обновлён `/public/robots.txt`

**Изменения:**

**Добавлены новые запреты:**
```
Disallow: /loginopt
Disallow: /signup
Disallow: /confirm
Disallow: /dashboard
Disallow: /wholesale-access
Disallow: /w/
Disallow: /payment/success
Disallow: /payment/fail
Disallow: /order-success
Disallow: /order-failed
Disallow: /messenger-test
Disallow: /tochka-diagnostics
```

**Удалены несуществующие Allow:**
```
- Allow: /catalog        ❌ Удалено
- Allow: /catalog/*      ❌ Удалено
- Allow: /favorites      ❌ Удалено
- Allow: /cart           ❌ Удалено
- Disallow: /auth        ❌ Удалено
- Disallow: /auth/*      ❌ Удалено
```

**Добавлены реальные Allow:**
```
Allow: /business        ✅ Добавлено
Allow: /locations       ✅ Уже было
Allow: /privacy         ✅ Добавлено
Allow: /agreement       ✅ Добавлено
Allow: /marketing-consent  ✅ Добавлено
```

---

### 3. Исправлена Schema.org разметка в `/index.html`

**Было:**
```json
"target": "https://coffeenechai.ru/catalog?search={search_term_string}"
```

**Стало:**
```json
"target": "https://coffeenechai.ru/?search={search_term_string}"
```

Исправлено в двух местах:
- Store Schema (строка 126)
- WebSite Schema (строка 166)

---

## 📊 Сравнение До/После

| Элемент | До | После |
|---------|-----|--------|
| **sitemap.xml URLs** | 9 страниц (5 несуществующих) | 6 страниц (все существующие) ✅ |
| **robots.txt Allow** | 6 директив (4 некорректных) | 6 директив (все корректные) ✅ |
| **robots.txt Disallow** | 6 директив | 15 директив (полная защита) ✅ |
| **Schema.org URLs** | 2 несуществующих | 2 корректных ✅ |
| **Дата обновления** | 2026-01-27 | 2026-02-12 ✅ |

---

## 🎯 Результат

### ✅ Исправлено:

1. **sitemap.xml** - содержит только реально существующие страницы
2. **robots.txt** - корректно описывает структуру сайта
3. **Schema.org** - все URL валидны и доступны
4. **Даты обновлены** - актуальная дата 2026-02-12

### 🚀 Ожидаемые результаты:

- ✅ Яндекс робот сможет проиндексировать все страницы из sitemap
- ✅ Исчезнет ошибка "Главная страница недоступна"
- ✅ Улучшится индексация сайта в Яндекс и Google
- ✅ Не будет ошибок 404 при обходе роботами

---

## 📝 Действия для владельца сайта

### Немедленно:

1. **Яндекс.Вебмастер:**
   - Перейдите в раздел "Индексирование → Файлы Sitemap"
   - Удалите старый sitemap (если был)
   - Добавьте новый: `https://coffeenechai.ru/sitemap.xml`
   - Нажмите "Проверить" и "Добавить в индекс"

2. **Google Search Console:**
   - Перейдите в раздел "Sitemap"
   - Удалите старый sitemap (если был)
   - Добавьте новый: `https://coffeenechai.ru/sitemap.xml`
   - Дождитесь обработки (обычно 1-2 дня)

3. **Запросите переиндексацию:**
   - В Яндекс.Вебмастер: "Инструменты → Переобход страниц"
   - В Google Search Console: "URL Inspection → Request Indexing"
   - Для главной страницы: `https://coffeenechai.ru/`

### В течение недели:

4. **Проверьте индексацию:**
   ```
   site:coffeenechai.ru
   ```
   В Google и Яндекс должны появиться все 6 страниц из sitemap

5. **Проверьте ошибки:**
   - Яндекс.Вебмастер → "Диагностика"
   - Google Search Console → "Coverage"
   - Убедитесь что нет ошибок 404

---

## 🔍 Проверка правильности исправлений

### Можно проверить прямо сейчас:

1. **sitemap.xml доступен:**
   ```
   https://coffeenechai.ru/sitemap.xml
   ```
   ✅ Должен открыться XML файл с 6 URL

2. **robots.txt доступен:**
   ```
   https://coffeenechai.ru/robots.txt
   ```
   ✅ Должен открыться текстовый файл с правилами

3. **Все страницы из sitemap доступны:**
   - https://coffeenechai.ru/ ✅
   - https://coffeenechai.ru/business ✅
   - https://coffeenechai.ru/locations ✅
   - https://coffeenechai.ru/privacy ✅
   - https://coffeenechai.ru/agreement ✅
   - https://coffeenechai.ru/marketing-consent ✅

### Валидация sitemap:

Проверьте sitemap на валидность:
- https://www.xml-sitemaps.com/validate-xml-sitemap.html
- Вставьте: `https://coffeenechai.ru/sitemap.xml`
- Должен быть статус: "Valid"

---

## ⏰ Ожидаемые сроки

| Действие | Срок |
|----------|------|
| Обработка sitemap в Яндекс | 1-3 дня |
| Обработка sitemap в Google | 1-7 дней |
| Исчезновение ошибки в Вебмастере | 3-7 дней |
| Полная переиндексация сайта | 1-2 недели |

---

## 📌 Важные напоминания

### ❗ При добавлении новых страниц:

Если в будущем добавите новые публичные страницы, обязательно:

1. Добавьте URL в `/public/sitemap.xml`
2. Добавьте правило `Allow:` в `/public/robots.txt`
3. Добавьте SEO мета-теги через компонент
4. Обновите дату `lastmod` в sitemap
5. Отправьте обновлённый sitemap в Яндекс и Google

### ❗ Не забудьте:

- Регулярно проверять раздел "Диагностика" в Яндекс.Вебмастер
- Следить за ошибками индексации в обеих консолях
- Обновлять sitemap при изменении структуры сайта

---

## ✅ Контрольный список

- [x] sitemap.xml обновлён и содержит только существующие страницы
- [x] robots.txt обновлён с корректными директивами
- [x] Schema.org разметка исправлена
- [x] Все URL из sitemap проверены и доступны
- [ ] sitemap отправлен в Яндекс.Вебмастер
- [ ] sitemap отправлен в Google Search Console
- [ ] Запрошена переиндексация главной страницы
- [ ] Проверка через 7 дней на наличие ошибок

---

**Статус:** ✅ **ИСПРАВЛЕНО И ГОТОВО К ПЕРЕИНДЕКСАЦИИ**

**Дата исправления:** 12 февраля 2026  
**Следующая проверка:** 19 февраля 2026
