import { useEffect } from 'react';
import { useLocation } from 'react-router';

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  canonical?: string;
  /** Если true — title используется как есть, без добавления суффикса */
  rawTitle?: boolean;
  ogImage?: string;
  ogType?: string;
}

export function SEOHelmet({ title, description, keywords, canonical, rawTitle, ogImage, ogType }: SEOProps) {
  const location = useLocation();

  useEffect(() => {
    // КРИТИЧНО: Удаляем любые noindex теги и устанавливаем правильный robots
    ensureIndexable();
    startSeoWatcher();

    // Формируем итоговый title: rawTitle или уже содержит «Нечай» → без суффикса
    const finalTitle = title
      ? (rawTitle || title.includes('Нечай') || title.includes('Nechai')
          ? title
          : `${title} | Кофе Нечай`)
      : 'Кофе Нечай — specialty кофе с обжаркой в Петербурге';

    document.title = finalTitle;

    // description
    if (description) {
      setOrCreate('meta', 'name', 'description', 'content', description);
    }

    // keywords
    if (keywords) {
      setOrCreate('meta', 'name', 'keywords', 'content', keywords);
    }

    // canonical
    const fullCanonical = canonical || `https://coffeenechai.ru${location.pathname}`;
    let linkCanonical = document.querySelector('link[rel="canonical"]');
    if (!linkCanonical) {
      linkCanonical = document.createElement('link');
      linkCanonical.setAttribute('rel', 'canonical');
      document.head.appendChild(linkCanonical);
    }
    linkCanonical.setAttribute('href', fullCanonical);

    // Open Graph
    const ogImg = ogImage || 'https://coffeenechai.ru/og-image.png';
    updateMetaTag('og:title', finalTitle);
    updateMetaTag('og:description', description || 'Кофе Нечай — свежеобжаренный specialty кофе в зернах. Обжарка в Санкт-Петербурге. Доставка по всей России.');
    updateMetaTag('og:url', fullCanonical);
    updateMetaTag('og:type', ogType || 'website');
    updateMetaTag('og:site_name', 'Кофе Нечай');
    updateMetaTag('og:image', ogImg);
    if (!ogImage) {
      updateMetaTag('og:image:width', '1000');
      updateMetaTag('og:image:height', '1000');
    }
    updateMetaTag('og:image:alt', 'Кофе Нечай — specialty кофе');
    updateMetaTag('og:locale', 'ru_RU');

    // Twitter / VK
    updateMetaTag('twitter:card', 'summary_large_image', 'name');
    updateMetaTag('twitter:title', finalTitle, 'name');
    updateMetaTag('twitter:description', description || 'Кофе Нечай — свежеобжаренный specialty кофе с доставкой по России.', 'name');
    updateMetaTag('twitter:image', ogImg, 'name');

    // Язык
    document.documentElement.lang = 'ru';
  }, [title, description, keywords, canonical, ogImage, ogType, location.pathname]);

  return null;
}

function setOrCreate(tag: string, attrKey: string, attrVal: string, contentKey: string, contentVal: string) {
  let el = document.querySelector(`${tag}[${attrKey}="${attrVal}"]`);
  if (!el) {
    el = document.createElement(tag);
    el.setAttribute(attrKey, attrVal);
    document.head.appendChild(el);
  }
  el.setAttribute(contentKey, contentVal);
}

function ensureIndexable() {
  const robotsTags = document.querySelectorAll('meta[name="robots"]');
  let foundNoindex = false;
  robotsTags.forEach(tag => {
    const content = tag.getAttribute('content') || '';
    if (content.includes('noindex')) {
      foundNoindex = true;
      tag.remove();
    }
  });

  setOrCreate('meta', 'name', 'robots', 'content', 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1');
  setOrCreate('meta', 'name', 'googlebot', 'content', 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1');
  setOrCreate('meta', 'name', 'yandex', 'content', 'index, follow');

  if (foundNoindex) {
    // тихо логируем только в dev, не пугая продакшн-консоль
    if (import.meta.env?.DEV) {
      console.log('[SEO] Removed noindex tag injected by platform');
    }
  }
}

// Запускаем повторно через 500ms и 2000ms — на случай, если платформа
// добавляет noindex асинхронно после первого рендера React
let _seoWatcherStarted = false;
function startSeoWatcher() {
  if (_seoWatcherStarted) return;
  _seoWatcherStarted = true;
  setTimeout(ensureIndexable, 500);
  setTimeout(ensureIndexable, 2000);
  // MutationObserver: следим за появлением noindex в <head>
  const observer = new MutationObserver(() => {
    const bad = document.querySelector('meta[name="robots"][content*="noindex"]');
    if (bad) {
      bad.remove();
      setOrCreate('meta', 'name', 'robots', 'content', 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1');
    }
  });
  observer.observe(document.head, { childList: true, subtree: true, attributes: true, attributeFilter: ['content'] });
}

function updateMetaTag(property: string, content: string, attributeName: string = 'property') {
  let meta = document.querySelector(`meta[${attributeName}="${property}"]`);
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute(attributeName, property);
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', content);
}

// ─── Конфиги SEO для страниц ──────────────────────────────────────────────────
export const SEOConfig = {
  home: {
    title: 'Кофе Нечай — нечай кофе, specialty обжарка и доставка по России',
    description: 'Кофе Нечай и нечай кофе — свежеобжаренный specialty кофе в зернах из Бразилии, Эфиопии, Колумбии, Кении. Обжарка в Санкт-Петербурге. Доставка по всей России.',
    keywords: 'кофе нечай, нечай кофе, Кофе Нечай, nechai coffee, кофе нечай спб, coffeenechai.ru, кофе в зернах, свежая обжарка, спешелти кофе, specialty coffee, обжарка кофе петербург, купить кофе нечай, кофе доставка россия',
    rawTitle: true,
  },
  catalog: {
    title: 'Каталог кофе — Кофе Нечай',
    description: 'Каталог свежеобжаренного кофе в зернах от Кофе Нечай. Спешелти кофе из разных стран: Бразилия, Эфиопия, Колумбия, Кения. Фильтр и эспрессо, дрипы.',
    keywords: 'каталог кофе нечай, купить кофе в зернах, нечай кофе каталог, спешелти кофе, кофе из Бразилии, кофе из Эфиопии, арабика, свежая обжарка нечай',
  },
  favorites: {
    title: 'Избранное — Кофе Нечай',
    description: 'Ваши избранные позиции кофе в интернет-магазине Кофе Нечай.',
    keywords: 'избранное кофе нечай, любимый кофе, нечай кофе избранное',
  },
  cart: {
    title: 'Корзина — Кофе Нечай',
    description: 'Корзина покупок в интернет-магазине Кофе Нечай. Оформите заказ с доставкой по России.',
    keywords: 'корзина нечай, оформить заказ кофе нечай, купить кофе нечай',
  },
  wholesale: {
    title: 'Оптовый каталог — Кофе Нечай | Нечай опт',
    description: 'Нечай опт — оптовая продажа кофе для бизнеса. Специальные цены для кофеен, ресторанов и магазинов. Свежая обжарка в Санкт-Петербурге.',
    keywords: 'нечай опт, кофе нечай опт, кофе оптом нечай, кофе для бизнеса, кофе для кофейни, оптовые поставки кофе',
  },
  business: {
    title: 'Оптовые поставки кофе для бизнеса — Кофе Нечай',
    description: 'Поставки свежеобжаренного кофе для кофеен, ресторанов, магазинов. Индивидуальные условия, гибкие цены, профессиональная поддержка.',
    keywords: 'кофе для бизнеса, поставки кофе, кофе для кофейни, кофе для ресторана, опт кофе, партнерство кофе',
  },
  privacy: {
    title: 'Политика конфиденциальности — Кофе Нечай',
    description: 'Политика конфиденциальности интернет-магазина Кофе Нечай. Информация о защите персональных данных.',
    keywords: 'политика конфиденциальности кофе нечай, защита данных',
  },
  agreement: {
    title: 'Пользовательское соглашение — Кофе Нечай',
    description: 'Пользовательское соглашение интернет-магазина Кофе Нечай. Условия использования сайта и оформления заказов.',
    keywords: 'пользовательское соглашение кофе нечай',
  },
  marketingConsent: {
    title: 'Согласие на рассылку — Кофе Нечай',
    description: 'Согласие на получение информационных и рекламных сообщений от Кофе Нечай.',
    keywords: 'согласие на рассылку кофе нечай',
  },
  orderSuccess: {
    title: 'Заказ оформлен — Кофе Нечай',
    description: 'Ваш заказ успешно оформлен. Спасибо за покупку в Кофе Нечай!',
    keywords: 'заказ оформлен кофе нечай',
  },
  paymentSuccess: {
    title: 'Оплата прошла — Кофе Нечай',
    description: 'Ваш платеж успешно обработан. Заказ принят в работу.',
    keywords: 'оплата успешна кофе нечай',
  },
  locations: {
    title: 'Где купить кофе Нечай в Санкт-Петербурге — Кофе Нечай',
    description: 'Точки продаж и кофейни-партнёры, где можно купить свежеобжаренный кофе Нечай в Санкт-Петербурге. Карта и адреса.',
    keywords: 'где купить кофе нечай, кофе нечай спб, точки продаж нечай, кофейни партнеры нечай, нечай кофе петербург',
    rawTitle: true,
  },
  harvest: {
    title: 'Календарь урожая кофе — Кофе Нечай',
    description: 'Сезоны сбора и экспорта кофе по странам-производителям. Календарь урожая для specialty кофе от Кофе Нечай.',
    keywords: 'календарь урожая кофе, сезон кофе, кофе нечай календарь, урожай арабики, нечай кофе',
    rawTitle: true,
  },
  contacts: {
    title: 'Контакты и реквизиты — Кофе Нечай',
    description: 'Контакты обжарки Кофе Нечай в Санкт-Петербурге, email, реквизиты для юридических лиц и оптовых клиентов.',
    keywords: 'контакты кофе нечай, реквизиты нечай кофе, кофе нечай связь, support coffeenechai',
    rawTitle: true,
  },
};