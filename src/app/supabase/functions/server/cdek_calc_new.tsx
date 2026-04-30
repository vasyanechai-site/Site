// Новая версия CDEK calc - только тариф 136 (ПВЗ→ПВЗ)
export const cdekCalcHandler = async (c: any) => {
  try {
    const { city_to, order_price, packages, pvz_code } = await c.req.json();
    
    if (!pvz_code || order_price === undefined) {
      return c.json({ error: 'Missing pvz_code or order_price' }, 400);
    }

    console.log('CDEK calc request:', { 
      city_to, 
      pvz_code,
      order_price, 
      packages_count: packages?.length 
    });

    // Настройки доставки
    const FREE_SHIPPING_FROM = 3500;
    const PROCESSING_DAYS = 2;
    const SENDER_PVZ_CODE = 'SPB1204'; // Код ПВЗ отправителя в СПб
    const TARIFF_CODE = 136; // Посылка склад-склад (ПВЗ→ПВЗ)

    // Если сумма заказа >= 3500, доставка бесплатная
    if (order_price >= FREE_SHIPPING_FROM) {
      return c.json({
        delivery_cost: 0,
        delivery_days: PROCESSING_DAYS,
        is_free: true,
        tariff_code: TARIFF_CODE
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

    // Тариф 136 требует минимум 1кг
    if (totalWeight < 1000) {
      console.log(`⚠️ Tariff 136 requires min 1kg, rounding up from ${totalWeight}g to 1000g`);
      totalWeight = 1000;
    }

    // Конвертируем габариты в мм для API СДЭК
    const lengthMm = Math.round(maxLength * 10);
    const widthMm = Math.round(maxWidth * 10);
    const heightMm = Math.round(maxHeight * 10);

    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔍 Calculating tariff ${TARIFF_CODE} (Посылка ПВЗ→ПВЗ)`);
    console.log(`📍 Route: ${SENDER_PVZ_CODE} → ${pvz_code}`);
    console.log(`⚖️ Total weight: ${totalWeight}g`);
    console.log(`📐 Dimensions: ${lengthMm}×${widthMm}×${heightMm}mm (${maxLength}×${maxWidth}×${maxHeight}cm)`);
    console.log(`💰 Goods value: ${order_price} RUB`);
    console.log(`${'='.repeat(60)}\n`);

    // Получаем токен СДЭК (функция getCdekToken должна быть доступна)
    const { getCdekToken } = await import('./index.tsx');
    const token = await getCdekToken();
    
    const calcBody = {
      type: 1, // Онлайн-магазин
      currency: 1, // RUB
      tariff_code: TARIFF_CODE,
      from_location: {
        code: SENDER_PVZ_CODE // Код ПВЗ отправителя
      },
      to_location: {
        code: pvz_code // Код выбранного ПВЗ получателя
      },
      packages: [{
        weight: totalWeight, // грамм
        length: lengthMm, // мм
        width: widthMm, // мм
        height: heightMm // мм
      }]
    };

    console.log(`📤 Request to CDEK:`, JSON.stringify(calcBody, null, 2));

    const response = await fetch('https://api.cdek.ru/v2/calculator/tariff', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(calcBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ CDEK API error (${response.status}):`, errorText);
      return c.json({ 
        error: 'Не удалось рассчитать стоимость доставки. Попробуйте позже.' 
      }, 400);
    }

    const data = await response.json();
    
    console.log(`\n✅ CDEK API RESPONSE:`);
    console.log(`💰 total_sum: ${data.total_sum} RUB`);
    console.log(`📦 delivery_sum: ${data.delivery_sum} RUB`);
    console.log(`⏱️ period: ${data.period_min}-${data.period_max} days`);
    console.log(`⚖️ weight_calc: ${data.weight_calc}g`);
    console.log(`📊 Full response:`, JSON.stringify(data, null, 2));
    console.log(`${'='.repeat(60)}\n`);

    if (!data || !data.total_sum) {
      return c.json({ 
        error: 'СДЭК не вернул стоимость доставки' 
      }, 400);
    }

    const deliveryCost = Math.round(data.total_sum);
    const deliveryDays = (data.period_min || 0) + PROCESSING_DAYS;

    console.log(`✅ Final delivery cost: ${deliveryCost} RUB (${deliveryDays} days)`);

    return c.json({
      delivery_cost: deliveryCost,
      delivery_days: deliveryDays,
      is_free: false,
      tariff_code: TARIFF_CODE,
      period_min: data.period_min,
      period_max: data.period_max
    });
  } catch (error) {
    console.error('Error calculating CDEK cost:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
};
