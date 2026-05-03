> **Сводка по проекту (май 2026):** данные и заказы — **Node API** (`server/`), фронт в проде — только **`dist/`** после `npm run build` (в `index.html` — скрипты `/assets/*.js`, не `/src/main.tsx`, иначе «белый экран»). Актуальные инструкции: в корне **`README.md`**, **`НАЧАЛО-БЕЗ-КОДА.md`**, **`ПРОДАКШН-100-ПРОЦЕНТОВ.md`**, **`DEPLOY_REGRU.md`**; быстрый старт во фронте — **`src/app/START_HERE.md`**.
>
> _Ниже — архивная или тематическая заметка; шаги, где основной бэкенд описан только как Supabase Edge без Node, для текущего продакшена могут быть неполными._

# Обновление Яндекс.Метрики

**Дата обновления:** 7 февраля 2026  
**Статус:** ✅ Завершено

## Что сделано

Обновлен код счетчика Яндекс.Метрики в `/index.html`:

### Изменения

**Старый ID:** `104940783`  
**Новый ID:** `106701177`

### Расположение кода

Код счетчика размещен в секции `<head>` в строках 69-81 файла `/index.html`, сразу после мета-тегов для Mobile Web App и Theme Color, перед структурированными данными JSON-LD.

## Новый код счетчика

```html
<!-- Yandex.Metrika counter -->
<script type="text/javascript">
    (function(m,e,t,r,i,k,a){
        m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
        m[i].l=1*new Date();
        for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
        k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
    })(window, document,'script','https://mc.yandex.ru/metrika/tag.js?id=106701177', 'ym');

    ym(106701177, 'init', {ssr:true, webvisor:true, clickmap:true, ecommerce:"dataLayer", referrer: document.referrer, url: location.href, accurateTrackBounce:true, trackLinks:true});
</script>
<noscript><div><img src="https://mc.yandex.ru/watch/106701177" style="position:absolute; left:-9999px;" alt="" /></div></noscript>
<!-- /Yandex.Metrika counter -->
```

## Включенные функции

✅ **ssr: true** - поддержка серверного рендеринга  
✅ **webvisor: true** - Вебвизор (запись сессий пользователей)  
✅ **clickmap: true** - Карта кликов  
✅ **ecommerce: "dataLayer"** - E-commerce tracking через dataLayer  
✅ **referrer: document.referrer** - отслеживание источника перехода  
✅ **url: location.href** - отслеживание текущего URL  
✅ **accurateTrackBounce: true** - точный показатель отказов  
✅ **trackLinks: true** - отслеживание кликов по ссылкам  

## Обновленные файлы

### Основной файл
- ✅ `/index.html` - обновлен код счетчика (ID: 106701177)

### Документация
- ✅ `/SEO_CHECKLIST.md` - обновлен ID счетчика
- ✅ `/SEO_SETUP_COMPLETE.md` - обновлен ID счетчика и добавлены новые параметры
- ✅ `/SEO_STATUS.md` - обновлен ID счетчика (2 упоминания)

## Проверка работоспособности

### Как проверить, что счетчик работает:

1. **Откройте сайт** в браузере
2. **Откройте DevTools** (F12)
3. **Перейдите во вкладку Console**
4. **Введите команду:**
   ```javascript
   ym
   ```
5. Должна отобразиться функция Яндекс.Метрики
6. **Проверьте Network:**
   - Должен быть запрос к `mc.yandex.ru/metrika/tag.js?id=106701177`
   - Должны быть запросы к `mc.yandex.ru/watch/...`

### В панели Яндекс.Метрики:

1. Зайдите на https://metrika.yandex.ru/
2. Выберите счетчик 106701177
3. В разделе "Сейчас на сайте" должны появиться онлайн пользователи (при наличии трафика)
4. В настройках проверьте статус "Счетчик установлен" - должна быть зеленая галочка

## Дополнительная информация

### Преимущества новых параметров:

- **referrer** и **url** - позволяют точнее отслеживать источники трафика и навигацию
- Эти параметры особенно полезны для SPA (Single Page Application) на React

### DNS Prefetch

В `/index.html` уже настроены оптимизации для быстрой загрузки Метрики:
```html
<link rel="dns-prefetch" href="https://mc.yandex.ru" />
<link rel="preconnect" href="https://mc.yandex.ru" crossorigin />
```

## Следующие шаги

- [ ] Убедиться, что счетчик 106701177 активен в панели Яндекс.Метрики
- [ ] Проверить, что данные начали поступать (может занять до 24 часов)
- [ ] Настроить цели и e-commerce (если требуется)
- [ ] Проверить работу Вебвизора через несколько часов после установки

---

**📊 Счетчик успешно обновлен и готов к работе!**
