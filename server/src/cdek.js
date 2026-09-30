const SENDER_CITY_CODE = 137;
const FALLBACK_TARIFFS = [136, 483, 234, 138, 139];
const YANDEX_GEOSUGGEST_URL = "https://suggest-maps.yandex.ru/v1/suggest";
const YANDEX_GEOSUGGEST_KEY =
  (process.env.YANDEX_GEOSUGGEST_API_KEY ||
    process.env.YANDEX_MAPS_API_KEY ||
    process.env.VITE_YANDEX_MAPS_API_KEY ||
    "d273f32f-f343-413c-b1d4-9fc8c0879682").trim();
const CITY_SEARCH_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

let cachedToken = null;
let tokenExpiry = 0;
let cachedTokenForBase = "";
const citySearchCache = new Map();

/**
 * Базовый URL API 2.0 (оканчивается на `/v2`).
 * Боевой: https://api.cdek.ru/v2 — только боевые Account/Secret из ЛК.
 * Тестовый: https://api.edu.cdek.ru/v2 — только тестовая пара; на боевом хосте даст «No such account secure».
 */
export function getCdekApiBase() {
  const fromEnv = (process.env.CDEK_API_URL || "").trim().replace(/\/+$/, "");
  if (fromEnv) {
    return /\/v2$/i.test(fromEnv) ? fromEnv : `${fromEnv.replace(/\/$/, "")}/v2`;
  }
  const useTest = String(process.env.CDEK_USE_TEST_API || "").trim().toLowerCase();
  if (useTest === "1" || useTest === "true" || useTest === "yes") {
    return "https://api.edu.cdek.ru/v2";
  }
  return "https://api.cdek.ru/v2";
}

export async function getCdekToken() {
  const base = getCdekApiBase();
  if (cachedToken && Date.now() < tokenExpiry && cachedTokenForBase === base) {
    return cachedToken;
  }

  const account = (process.env.CDEK_ACCOUNT || "").trim();
  const secret = (process.env.CDEK_SECRET || "").trim();

  if (!account || !secret) {
    throw new Error("CDEK_ACCOUNT or CDEK_SECRET is missing");
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: account,
    client_secret: secret,
  }).toString();

  const response = await fetch(`${base}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => "");
    const raw = errBody.trim().slice(0, 500);
    let hint = raw;
    try {
      const j = JSON.parse(errBody);
      if (j && typeof j === "object") {
        const parts = [j.error, j.error_description, j.message].filter(Boolean);
        if (parts.length) hint = parts.join(" — ");
      }
    } catch {
      /* оставить raw */
    }
    throw new Error(
      hint ? `Failed to get CDEK token: ${response.status} — ${hint}` : `Failed to get CDEK token: ${response.status}`,
    );
  }

  const data = await response.json();
  cachedToken = data.access_token;
  cachedTokenForBase = base;
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return cachedToken;
}

async function cdekRequest(endpoint, init = {}) {
  const base = getCdekApiBase();
  const token = await getCdekToken();
  const response = await fetch(`${base}${endpoint}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`CDEK ${endpoint} failed: ${response.status} ${errorText}`);
  }

  return response.json();
}

function normalizeLocationName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replaceAll("ё", "е")
    .replace(/\s+/g, " ");
}

function withoutLocalityPrefix(value) {
  return String(value || "")
    .trim()
    .replace(
      /^(?:город|г\.|пос[её]лок(?:\s+городского\s+типа)?|рабочий\s+пос[её]лок|пгт|село|деревня|станица|аул|хутор|агрогородок|насел[её]нный\s+пункт|кп|снт)\s+/i,
      "",
    )
    .trim();
}

function mapCdekCity(city) {
  return {
    code: city.code,
    city: city.city,
    region: city.region,
    country: city.country,
    country_code: city.country_code,
    city_code: city.code,
    full_name: city.region ? `${city.city}, ${city.region}` : city.city,
    latitude: Number(city.latitude) || 0,
    longitude: Number(city.longitude) || 0,
  };
}

async function getCdekCitiesByName(cityName) {
  const raw = await cdekRequest(
    `/location/cities?city=${encodeURIComponent(cityName)}&country_codes=RU&size=100`,
  );
  return Array.isArray(raw) ? raw : [];
}

async function getYandexCitySuggestions(query) {
  if (!YANDEX_GEOSUGGEST_KEY) return [];

  const params = new URLSearchParams({
    apikey: YANDEX_GEOSUGGEST_KEY,
    text: query,
    lang: "ru",
    results: "10",
    countries: "ru",
    types: "locality",
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(`${YANDEX_GEOSUGGEST_URL}?${params}`, {
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Yandex Geosuggest HTTP ${response.status}`);
    }

    const data = await response.json();
    const seen = new Set();

    return (Array.isArray(data?.results) ? data.results : [])
      .map((row) => {
        const city = String(row?.title?.text || "").trim();
        const region = String(row?.subtitle?.text || "").trim();
        return { city, region };
      })
      .filter(({ city, region }) => {
        const key = `${normalizeLocationName(city)}|${normalizeLocationName(region)}`;
        if (!city || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map(({ city, region }) => ({
        code: 0,
        city,
        region,
        country: "Россия",
        country_code: "RU",
        city_code: 0,
        full_name: region ? `${city}, ${region}` : city,
        latitude: 0,
        longitude: 0,
      }));
  } finally {
    clearTimeout(timeout);
  }
}

export async function searchCities(query) {
  const q = (query || "").trim();
  if (q.length < 3) {
    return { cities: [] };
  }

  const cacheKey = normalizeLocationName(q);
  const cached = citySearchCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return { cities: cached.cities };
  }

  let cities = [];
  try {
    const cdekCities = await getCdekCitiesByName(q);
    cities = cdekCities
      .filter((item) => normalizeLocationName(item.city).includes(cacheKey))
      .slice(0, 20)
      .map(mapCdekCity);
  } catch (error) {
    console.warn("[cdek] exact city search failed, using geosuggest:", error?.message || error);
  }

  // CDEK API 2.0 ищет `city` только по полному названию. Для автодополнения
  // по первым буквам используем Geosuggest, а CDEK-код определяем после
  // выбора подсказки — перед загрузкой ПВЗ.
  if (cities.length === 0) {
    try {
      cities = await getYandexCitySuggestions(q);
    } catch (error) {
      console.warn("[cdek] Yandex city suggestions failed:", error?.message || error);
    }
  }

  if (citySearchCache.size >= 200) {
    citySearchCache.delete(citySearchCache.keys().next().value);
  }
  citySearchCache.set(cacheKey, {
    cities,
    expiresAt: Date.now() + CITY_SEARCH_CACHE_TTL_MS,
  });

  return { cities };
}

async function resolveCdekCity(cityName, regionName) {
  const requestedRegion = normalizeLocationName(regionName);
  const names = [...new Set([String(cityName || "").trim(), withoutLocalityPrefix(cityName)].filter(Boolean))];

  for (const name of names) {
    const rows = await getCdekCitiesByName(name);
    if (!rows.length) continue;

    const normalizedName = normalizeLocationName(name);
    const exact = rows.filter((row) => normalizeLocationName(row.city) === normalizedName);
    const candidates = exact.length > 0 ? exact : rows;

    if (requestedRegion) {
      const byRegion = candidates.find((row) => {
        const candidateRegion = normalizeLocationName(row.region);
        return (
          candidateRegion &&
          (requestedRegion.includes(candidateRegion) || candidateRegion.includes(requestedRegion))
        );
      });
      if (byRegion) return byRegion;
    }

    if (candidates[0]) return candidates[0];
  }

  return null;
}

export async function getPickupPoints({ city_to, city_code, region_to }) {
  if (!city_to && !city_code) {
    throw new Error("city_to or city_code is required");
  }

  let cityCode = city_code;
  if (!cityCode) {
    const city = await resolveCdekCity(city_to, region_to);
    if (!city) return { city_code: null, pickup_points: [] };
    cityCode = city.code;
  }

  const pvz = await cdekRequest(`/deliverypoints?city_code=${cityCode}&type=PVZ`);
  const rows = Array.isArray(pvz) ? pvz : [];
  const onlyPvz = rows.filter((p) => p.type === "PVZ" || !p.type);
  return {
    city_code: cityCode,
    pickup_points: onlyPvz.map((point) => ({
      code: point.code,
      name: point.name,
      address: point.location?.address_full || point.location?.address || "Адрес не указан",
      location: {
        latitude: Number(point.location?.latitude) || 0,
        longitude: Number(point.location?.longitude) || 0,
      },
      work_time: point.work_time || "Не указано",
      phones: point.phones || [],
    })),
  };
}

export async function calculateDelivery({ city_to, city_code, region_to, pvz_code, order_price, packages }) {
  if (!pvz_code || order_price === undefined) {
    throw new Error("pvz_code and order_price are required");
  }

  const orderPriceNum = Number(order_price) || 0;
  if (orderPriceNum >= 3500) {
    return { delivery_cost: 0, delivery_days: 2, is_free: true, tariff_code: 136 };
  }

  let receiverCityCode = city_code;
  if (!receiverCityCode) {
    const city = await resolveCdekCity(city_to, region_to);
    if (!city) throw new Error("Receiver city code not found");
    receiverCityCode = city.code;
  }

  const dims = (packages || []).reduce(
    (acc, pkg) => {
      const qty = Number(pkg.quantity) || 1;
      const weight = Math.max(Number(pkg.weight) || 200, 100);
      const length = Math.max(Number(pkg.length) || 10, 5);
      const width = Math.max(Number(pkg.width) || 8, 5);
      const height = Math.max(Number(pkg.height) || 5, 3);
      acc.weight += weight * qty;
      acc.length = Math.max(acc.length, length);
      acc.width = Math.max(acc.width, width);
      acc.height = Math.max(acc.height, height);
      return acc;
    },
    { weight: 500, length: 20, width: 15, height: 10 },
  );

  const sorted = [dims.length, dims.width, dims.height].sort((a, b) => b - a);
  const payloadBase = {
    type: 1,
    currency: 1,
    from_location: { code: SENDER_CITY_CODE },
    to_location: { code: receiverCityCode },
    packages: [
      {
        weight: Math.round(dims.weight),
        length: Math.round(sorted[0]),
        width: Math.round(sorted[1]),
        height: Math.round(sorted[2]),
      },
    ],
    services: [],
  };

  const tariffs = SENDER_CITY_CODE === receiverCityCode ? [483, 234, 138, 139] : FALLBACK_TARIFFS;

  for (const tariff of tariffs) {
    const data = await cdekRequest("/calculator/tariff", {
      method: "POST",
      body: JSON.stringify({ ...payloadBase, tariff_code: tariff }),
    });
    const price = Number(data.total_sum || 0);
    if ((!data.errors || data.errors.length === 0) && price > 0 && price <= 5000) {
      return {
        delivery_cost: price,
        delivery_days: Number(data.period_min || 0) + 2,
        is_free: false,
        tariff_code: tariff,
        period_min: data.period_min,
        period_max: data.period_max,
      };
    }
  }

  throw new Error("No available CDEK tariff for selected route");
}
