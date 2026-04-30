const CDEK_API_URL = "https://api.cdek.ru/v2";
const SENDER_CITY_CODE = 137;
const FALLBACK_TARIFFS = [136, 483, 234, 138, 139];

let cachedToken = null;
let tokenExpiry = 0;

async function getCdekToken() {
  if (cachedToken && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  const account = process.env.CDEK_ACCOUNT;
  const secret = process.env.CDEK_SECRET;

  if (!account || !secret) {
    throw new Error("CDEK_ACCOUNT or CDEK_SECRET is missing");
  }

  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: account,
    client_secret: secret,
  });

  const response = await fetch(`${CDEK_API_URL}/oauth/token?${params.toString()}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  if (!response.ok) {
    throw new Error(`Failed to get CDEK token: ${response.status}`);
  }

  const data = await response.json();
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return cachedToken;
}

async function cdekRequest(endpoint, init = {}) {
  const token = await getCdekToken();
  const response = await fetch(`${CDEK_API_URL}${endpoint}`, {
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

export async function searchCities(query) {
  if (!query || query.length < 2) {
    return { cities: [] };
  }

  const cities = await cdekRequest(
    `/location/cities?city=${encodeURIComponent(query)}&country_codes=RU&size=20`,
  );

  return {
    cities: (cities || []).map((city) => ({
      code: city.code,
      city: city.city,
      region: city.region,
      country: city.country,
      country_code: city.country_code,
      city_code: city.code,
      full_name: city.region ? `${city.city}, ${city.region}` : city.city,
      latitude: city.latitude || 0,
      longitude: city.longitude || 0,
    })),
  };
}

export async function getPickupPoints({ city_to, city_code }) {
  if (!city_to && !city_code) {
    throw new Error("city_to or city_code is required");
  }

  let cityCode = city_code;
  if (!cityCode) {
    const cities = await cdekRequest(
      `/location/cities?city=${encodeURIComponent(city_to)}&country_codes=RU&size=1`,
    );
    if (!cities?.length) return { city_code: null, pickup_points: [] };
    cityCode = cities[0].code;
  }

  const pvz = await cdekRequest(`/deliverypoints?city_code=${cityCode}&type=PVZ`);
  return {
    city_code: cityCode,
    pickup_points: (pvz || []).map((point) => ({
      code: point.code,
      name: point.name,
      address: point.location?.address_full || point.location?.address || "Адрес не указан",
      location: {
        latitude: point.location?.latitude || 0,
        longitude: point.location?.longitude || 0,
      },
      work_time: point.work_time || "Не указано",
      phones: point.phones || [],
    })),
  };
}

export async function calculateDelivery({ city_to, city_code, pvz_code, order_price, packages }) {
  if (!pvz_code || order_price === undefined) {
    throw new Error("pvz_code and order_price are required");
  }

  const orderPriceNum = Number(order_price) || 0;
  if (orderPriceNum >= 3500) {
    return { delivery_cost: 0, delivery_days: 2, is_free: true, tariff_code: 136 };
  }

  let receiverCityCode = city_code;
  if (!receiverCityCode) {
    const cities = await cdekRequest(
      `/location/cities?city=${encodeURIComponent(city_to)}&country_codes=RU&size=1`,
    );
    if (!cities?.length) throw new Error("Receiver city code not found");
    receiverCityCode = cities[0].code;
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
