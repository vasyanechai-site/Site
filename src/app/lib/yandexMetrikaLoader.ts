const METRIKA_ID = 106701177;

type WindowYm = Window & {
  __nechai_ym_loaded?: boolean;
  ym?: (id: number, method: string, ...args: unknown[]) => void;
};

/** Однократная загрузка Яндекс.Метрики (после согласия пользователя на аналитику). */
export function loadYandexMetrika(): void {
  if (typeof window === 'undefined') return;
  const w = window as WindowYm;
  if (w.__nechai_ym_loaded) return;
  w.__nechai_ym_loaded = true;

  const tagUrl = `https://mc.yandex.ru/metrika/tag.js?id=${METRIKA_ID}`;
  // Официальный фрагмент инициализации tag.js (Яндекс.Метрика)
  (function (
    m: Window,
    e: Document,
    t: string,
    r: string,
    i: string,
    k?: HTMLScriptElement,
    a?: Element | null,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mm = m as any;
    mm[i] =
      mm[i] ||
      function (this: unknown) {
        // eslint-disable-next-line prefer-rest-params
        (mm[i].a = mm[i].a || []).push(arguments);
      };
    mm[i].l = Date.now();
    for (let j = 0; j < e.scripts.length; j++) {
      if (e.scripts[j].src === r) return;
    }
    k = e.createElement(t) as HTMLScriptElement;
    a = e.getElementsByTagName(t)[0];
    k.async = true;
    k.src = r;
    a?.parentNode?.insertBefore(k, a);
  })(window, document, 'script', tagUrl, 'ym');

  w.ym?.(METRIKA_ID, 'init', {
    ssr: true,
    webvisor: true,
    clickmap: true,
    ecommerce: 'dataLayer',
    referrer: document.referrer,
    url: location.href,
    accurateTrackBounce: true,
    trackLinks: true,
  });

  const img = document.createElement('img');
  img.src = `https://mc.yandex.ru/watch/${METRIKA_ID}`;
  img.alt = '';
  img.style.position = 'absolute';
  img.style.left = '-9999px';
  const div = document.createElement('div');
  div.appendChild(img);
  document.body.appendChild(div);
}
