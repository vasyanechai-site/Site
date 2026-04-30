// ВРЕМЕННЫЙ ФАЙЛ - содержит новые эндпоинты СДЭК для копирования в index.tsx

// CDEK: Calculate shipping cost
app.post(`${prefix}/cdek/calc`, async (c) => {
  try {
    const { city_to, order_price, packages, pvz_code } = await c.req.json();
    
    if (!pvz_code || order_price === undefined) {
      return c.json({ error: 'Missing pvz_code or order_price' }, 400);
    }

    console.log('CDEK calc request:', { 
      city_to, 
      pvz_code,
      order_price, 
      order_price_type: typeof order_price,
      packages_count: packages?.length 
    });

    // Проверка на адекватность данных
    if (order_price > 1000000) {
      console.warn(`⚠️ WARNING: Order price is very high: ${order_price} RUB`);
    }

    // Настройки доставки
    const FREE_SHIPPING_FROM = 3500;
    const PROCESSING_DAYS = 2;
    const SENDER_CITY_CODE = 137; // Санкт-Петербург
    
    // Fallback тарифы как у Тильды
    const FALLBACK_TARIFFS = [136, 137, 139, 234, 368];

    // Инициализируем debug-объект
    const debug: any = {
      selected_pvz_code: pvz_code,
      fallback_tariffs: FALLBACK_TARIFFS
    };

    // Если сумма заказа >= 3500, доставка бесплатная
    if (order_price >= FREE_SHIPPING_FROM) {
      return c.json({
        delivery_cost: 0,
        delivery_days: PROCESSING_DAYS,
        is_free: true,
        tariff_code: FALLBACK_TARIFFS[0],
        debug
      });
    }

    // Рассчитываем суммарные габариты и вес
    let totalWeight = 0;
    let maxLength = 0;
    let maxWidth = 0;
    let maxHeight = 0;

    if (packages && packages.length > 0) {
      console.log('📦 Incoming packages from frontend:', JSON.stringify(packages, null, 2));
      
      // Суммируем вес всех товаров
      packages.forEach((pkg: any) => {
        const quantity = pkg.quantity || 1;
        const weight = Math.max(Number(pkg.weight) || 500, 100); // грамм
        const length = Math.max(Number(pkg.length) || 20, 10); // см
        const width = Math.max(Number(pkg.width) || 15, 10); // см
        const height = Math.max(Number(pkg.height) || 10, 5); // см
        
        totalWeight += weight * quantity;
        maxLength = Math.max(maxLength, length);
        maxWidth = Math.max(maxWidth, width);
        maxHeight = Math.max(maxHeight, height);
        
        console.log(`📦 Item: ${weight}g × ${quantity} = ${weight * quantity}g, dims: ${length}×${width}×${height}cm`);
      });
    } else {
      // Дефолтные значения
      totalWeight = 500;
      maxLength = 20;
      maxWidth = 15;
      maxHeight = 10;
    }

    // Сохраняем вес до корректировки
    debug.weight_before = totalWeight;

    // Тариф 136 и другие требуют минимум 1кг - округляем всегда
    if (totalWeight < 1000) {
      console.log(`⚠️ Weight < 1kg, rounding up from ${totalWeight}g to 1000g`);
      totalWeight = 1000;
    }

    // Сохраняем вес после корректировки
    debug.weight_after = totalWeight;

    // Конвертируем габариты в мм для API СДЭК
    const lengthMm = Math.round(maxLength * 10);
    const widthMm = Math.round(maxWidth * 10);
    const heightMm = Math.round(maxHeight * 10);

    // Сохраняем габариты в debug
    debug.dimensions = {
      length_mm: lengthMm,
      width_mm: widthMm,
      height_mm: heightMm,
      length_cm: maxLength,
      width_cm: maxWidth,
      height_cm: maxHeight
    };

    // Получаем токен для API СДЭК
    const token = await getCdekToken();
    
    // Получаем информацию о выбранном ПВЗ, чтобы узнать city_code
    console.log(`🔍 Fetching PVZ info for code: ${pvz_code}`);
    const pvzInfoUrl = `https://api.cdek.ru/v2/deliverypoints?code=${pvz_code}`;
    debug.pvz_info_url = pvzInfoUrl;
    
    const pvzResponse = await fetch(pvzInfoUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
      }
    });

    if (!pvzResponse.ok) {
      const errorText = await pvzResponse.text();
      console.log(`❌ Failed to fetch PVZ info:`, errorText);
      debug.pvz_info_error = errorText;
      return c.json({ 
        error: `Не удалось получить информацию о ПВЗ: ${errorText}`,
        debug
      }, 400);
    }

    const pvzData = await pvzResponse.json();
    console.log(`📍 PVZ data:`, JSON.stringify(pvzData, null, 2));
    debug.pvz_info_response = pvzData;

    if (!pvzData || pvzData.length === 0) {
      debug.pvz_info_error = 'PVZ not found';
      return c.json({ 
        error: 'Пункт выдачи не найден',
        debug
      }, 400);
    }

    const selectedPvz = pvzData[0];
    const receiverCityCode = selectedPvz.location?.city_code;

    if (!receiverCityCode) {
      console.log(`❌ No city_code in PVZ data:`, selectedPvz);
      debug.pvz_info_error = 'No city_code in PVZ data';
      return c.json({ 
        error: 'Не удалось определить город для выбранного ПВЗ',
        debug
      }, 400);
    }
    
    console.log(`📍 Sender city code: ${SENDER_CITY_CODE} (Санкт-Петербург)`);
    console.log(`📍 Receiver city code: ${receiverCityCode} (${selectedPvz.location?.city})`);
    
    debug.sender_city_code = SENDER_CITY_CODE;
    debug.receiver_city_code = receiverCityCode;
    debug.receiver_city_name = selectedPvz.location?.city;

    // ========================================
    // ШАГ 2: FALLBACK ТАРИФОВ КАК У ТИЛЬДЫ
    // ========================================
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔍 Getting available tariffs for route`);
    console.log(`📍 Route: ${SENDER_CITY_CODE} (СПб) → ${receiverCityCode} (${selectedPvz.location?.city})`);
    console.log(`⚖️ Total weight: ${totalWeight}g`);
    console.log(`📐 Dimensions: ${lengthMm}×${widthMm}×${heightMm}mm`);
    console.log(`${'='.repeat(60)}\n`);

    // Запрашиваем список доступных тарифов
    const tariffListBody = {
      type: 1, // Онлайн-магазин
      currency: 1, // RUB
      lang: 'rus',
      from_location: {
        code: SENDER_CITY_CODE
      },
      to_location: {
        code: receiverCityCode
      },
      packages: [{
        weight: totalWeight,
        length: lengthMm,
        width: widthMm,
        height: heightMm
      }]
    };

    debug.tariff_list_request_body = tariffListBody;
    console.log(`📤 Tariff list request:`, JSON.stringify(tariffListBody, null, 2));

    const tariffListResponse = await fetch('https://api.cdek.ru/v2/calculator/tariff-list', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(tariffListBody)
    });

    if (!tariffListResponse.ok) {
      const errorText = await tariffListResponse.text();
      console.log(`❌ Failed to get tariff list:`, errorText);
      debug.tariff_list_error = errorText;
      return c.json({ 
        error: `Не удалось получить список тарифов: ${errorText}`,
        debug
      }, 400);
    }

    const tariffListData = await tariffListResponse.json();
    console.log(`✅ Tariff list response:`, JSON.stringify(tariffListData, null, 2));
    debug.tariff_list_response = tariffListData;

    // Извлекаем коды доступных тарифов из ответа
    const availableServices = tariffListData.tariff_codes || [];
    debug.available_services = availableServices;

    console.log(`📋 Available tariff codes from API:`, availableServices);

    // Выбираем первый подходящий тариф из fallback списка
    let selectedTariff = null;
    for (const tariff of FALLBACK_TARIFFS) {
      if (availableServices.some((s: any) => s.tariff_code === tariff)) {
        selectedTariff = tariff;
        console.log(`✅ Selected tariff ${tariff} from fallback list`);
        break;
      }
    }

    debug.selected_tariff = selectedTariff;

    // Если ни один тариф не подошел
    if (!selectedTariff) {
      console.log(`❌ No suitable tariff found from fallback list`);
      debug.tariff_selection_error = 'No suitable tariff available';
      return c.json({ 
        error: 'Доставка недоступна для этого ПВЗ. Выберите другой пункт выдачи.',
        debug
      }, 400);
    }

    // ========================================
    // ШАГ 4: РАСЧЁТ СТОИМОСТИ С ВЫБРАННЫМ ТАРИФОМ
    // ========================================

    console.log(`\n${'='.repeat(60)}`);
    console.log(`💰 Calculating cost for tariff ${selectedTariff}`);
    console.log(`${'='.repeat(60)}\n`);
    
    // Формируем тело запроса для расчёта стоимости
    const calcBody = {
      type: 1, // Онлайн-магазин
      currency: 1, // RUB
      tariff_code: selectedTariff,
      from_location: {
        code: SENDER_CITY_CODE // Код ГОРОДА отправителя (СПб)
      },
      to_location: {
        code: receiverCityCode // Код ГОРОДА получателя
      },
      packages: [{
        weight: totalWeight,
        length: lengthMm,
        width: widthMm,
        height: heightMm
      }],
      services: []
    };

    console.log(`📤 Full tariff request:`, JSON.stringify(calcBody, null, 2));
    debug.tariff_request_body = calcBody;

    // Вызываем API СДЭК для расчёта стоимости
    const fetchResponse = await fetch('https://api.cdek.ru/v2/calculator/tariff', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(calcBody)
    });

    const responseStatus = fetchResponse.status;
    debug.tariff_response_status = responseStatus;

    if (!fetchResponse.ok) {
      const errorText = await fetchResponse.text();
      console.log(`❌ CDEK API error (${fetchResponse.status}):`, errorText);
      debug.tariff_error = errorText;
      
      return c.json({ 
        error: `Ошибка расчета доставки СДЭК: ${errorText}`,
        debug
      }, 400);
    }

    const calcResponse = await fetchResponse.json();
    console.log(`\n✅ CDEK API SUCCESSFUL RESPONSE:`);
    console.log(`💰 total_sum: ${calcResponse.total_sum} RUB`);
    console.log(`📦 delivery_sum: ${calcResponse.delivery_sum} RUB`);
    console.log(`⏱️ period: ${calcResponse.period_min}-${calcResponse.period_max} days`);
    console.log(`⚖️ weight_calc: ${calcResponse.weight_calc}g`);
    console.log(`📊 Full response:`, JSON.stringify(calcResponse, null, 2));
    console.log(`${'='.repeat(60)}\n`);
    
    debug.tariff_raw_response = calcResponse;
    
    if (!calcResponse || !calcResponse.total_sum) {
      debug.tariff_error = 'No total_sum in response';
      return c.json({ 
        error: 'Не удалось рассчитать стоимость доставки. Попробуйте другой пункт выдачи.',
        debug
      }, 400);
    }

    // Проверяем адекватность цены
    if (calcResponse.total_sum > 10000) {
      console.warn(`⚠️ WARNING: CDEK returned VERY HIGH price: ${calcResponse.total_sum} RUB`);
      debug.price_warning = `Very high price: ${calcResponse.total_sum} RUB`;
    }

    let deliveryCost = calcResponse.total_sum || 0;
    const deliveryDays = (calcResponse.period_min || 0) + PROCESSING_DAYS;

    console.log(`💰 CDEK API returned total_sum: ${deliveryCost} RUB`);
    console.log(`✅ Final delivery cost: ${deliveryCost} RUB`);

    // Добавляем информацию о логике Тильды
    debug.tilda_logic = {
      weight_rounding: debug.weight_before < 1000 ? `Rounded ${debug.weight_before}g to 1000g` : 'No rounding needed',
      mode: `Tariff ${selectedTariff}`,
      free_shipping_threshold: FREE_SHIPPING_FROM,
      processing_days: PROCESSING_DAYS
    };

    return c.json({
      delivery_cost: deliveryCost,
      delivery_days: deliveryDays,
      is_free: false,
      tariff_code: selectedTariff,
      period_min: calcResponse.period_min,
      period_max: calcResponse.period_max,
      debug
    });

  } catch (error) {
    console.error('Error calculating CDEK delivery:', error);
    return c.json({ 
      error: error instanceof Error ? error.message : 'Failed to calculate delivery cost',
      debug: {
        exception: error instanceof Error ? error.message : String(error)
      }
    }, 500);
  }
});

// CDEK: Get pickup points list
app.post(`${prefix}/cdek/pvz`, async (c) => {
  try {
    const { city_to } = await c.req.json();
    
    if (!city_to) {
      return c.json({ error: 'Missing city_to' }, 400);
    }

    console.log('CDEK PVZ request for city:', city_to);

    const debug: any = {};

    // Найти city_code
    const citiesEndpoint = `/location/cities?city=${encodeURIComponent(city_to)}&country_codes=RU&size=1`;
    debug.city_lookup_url = `https://api.cdek.ru/v2${citiesEndpoint}`;
    
    const citiesResponse = await cdekRequest(citiesEndpoint);

    if (!citiesResponse || citiesResponse.length === 0) {
      debug.city_lookup_error = 'City not found';
      return c.json({ error: 'City not found', debug }, 404);
    }

    const cityCode = citiesResponse[0].code;
    debug.city_code = cityCode;

    // Получить список ПВЗ
    let pvzUrl = `/deliverypoints?city_code=${cityCode}&type=PVZ`;
    debug.pvz_query_url = `https://api.cdek.ru/v2${pvzUrl}`;
    
    const pvzResponse = await cdekRequest(pvzUrl);

    console.log(`CDEK API returned ${pvzResponse.length} pickup points for city code ${cityCode}`);
    debug.total_pvz = pvzResponse.length;

    // ========================================
    // ШАГ 1: ФИЛЬТРАЦИЯ ПВЗ ПО ПОДДЕРЖКЕ ТАРИФОВ
    // ========================================

    const SENDER_CITY_CODE = 137; // Санкт-Петербург
    const FALLBACK_TARIFFS = [136, 137, 139, 234, 368];
    const TEST_WEIGHT = 1000; // 1 кг для проверки
    const TEST_DIMENSIONS = { length: 200, width: 200, height: 200 }; // 20x20x20 см в мм

    const token = await getCdekToken();
    const availablePvz: any[] = [];

    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔍 Filtering PVZ by tariff support`);
    console.log(`📋 Testing ${pvzResponse.length} PVZ for tariff availability`);
    console.log(`${'='.repeat(60)}\n`);

    // Проверяем каждый ПВЗ на поддержку хотя бы одного из fallback тарифов
    for (const pvz of pvzResponse) {
      if (pvz.type !== 'PVZ') continue;

      const receiverCityCode = pvz.location?.city_code;
      if (!receiverCityCode) {
        console.log(`⚠️ PVZ ${pvz.code} has no city_code, skipping`);
        continue;
      }

      console.log(`🔍 Testing PVZ ${pvz.code} (${pvz.name})`);

      // Запрашиваем список доступных тарифов для этого ПВЗ
      const tariffListBody = {
        type: 1,
        currency: 1,
        lang: 'rus',
        from_location: {
          code: SENDER_CITY_CODE
        },
        to_location: {
          code: receiverCityCode
        },
        packages: [{
          weight: TEST_WEIGHT,
          length: TEST_DIMENSIONS.length,
          width: TEST_DIMENSIONS.width,
          height: TEST_DIMENSIONS.height
        }]
      };

      try {
        const tariffListResponse = await fetch('https://api.cdek.ru/v2/calculator/tariff-list', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(tariffListBody)
        });

        if (!tariffListResponse.ok) {
          console.log(`❌ PVZ ${pvz.code}: Failed to get tariff list`);
          continue;
        }

        const tariffListData = await tariffListResponse.json();
        const availableServices = tariffListData.tariff_codes || [];
        const availableTariffCodes = availableServices.map((s: any) => s.tariff_code);

        // Проверяем, поддерживается ли хотя бы один из fallback тарифов
        const supportedTariff = FALLBACK_TARIFFS.find(t => availableTariffCodes.includes(t));

        if (supportedTariff) {
          console.log(`✅ PVZ ${pvz.code}: Supports tariff ${supportedTariff}`);
          availablePvz.push({
            code: pvz.code,
            name: pvz.name,
            address: pvz.location?.address_full || pvz.location?.address || 'Адрес не указан',
            location: {
              latitude: pvz.location?.latitude || 0,
              longitude: pvz.location?.longitude || 0
            },
            work_time: pvz.work_time || 'Не указано',
            phones: pvz.phones || [],
            supported_tariff: supportedTariff,
            available_tariffs: availableTariffCodes
          });
        } else {
          console.log(`❌ PVZ ${pvz.code}: No supported tariffs (available: ${availableTariffCodes.join(', ')})`);
        }
      } catch (error) {
        console.log(`❌ PVZ ${pvz.code}: Error checking tariffs:`, error);
        continue;
      }
    }

    debug.available_pvz_for_tariffs = availablePvz.length;
    debug.filtered_out = pvzResponse.length - availablePvz.length;

    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ Filtering complete`);
    console.log(`📊 Total PVZ: ${pvzResponse.length}`);
    console.log(`✅ Available PVZ: ${availablePvz.length}`);
    console.log(`❌ Filtered out: ${debug.filtered_out}`);
    console.log(`${'='.repeat(60)}\n`);

    return c.json({
      city_code: cityCode,
      pickup_points: availablePvz,
      debug
    });

  } catch (error) {
    console.error('Error fetching CDEK pickup points:', error);
    return c.json({ 
      error: error instanceof Error ? error.message : 'Failed to fetch pickup points',
      debug: {
        exception: error instanceof Error ? error.message : String(error)
      }
    }, 500);
  }
});
