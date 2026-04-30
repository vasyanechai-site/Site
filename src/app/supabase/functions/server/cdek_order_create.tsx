// CDEK Order Creation Helper - Enhanced Version
// Создание заказа в СДЭК при оформлении розничного заказа
// С полной диагностикой и проверкой согласно SDK CDEK 2.0

import { getCdekToken } from './cdek-auth.tsx';

interface CdekOrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  weight: number; // граммы
  length: number; // см
  width: number;  // см
  height: number; // см
}

interface DeliveryInfo {
  city: string;
  pvzCode: string;
  pvzAddress: string;
  cost: number;
  days: number;
  tariffCode?: number;
}

interface CdekOrderResult {
  success: boolean;
  cdek_uuid?: string;
  cdek_number?: string;
  cdek_status: string;
  cdek_data?: any;
  cdek_error?: any;
  diagnostic?: any; // Диагностическая информация
}

// Константы API
const CDEK_API_URL = 'https://api.cdek.ru/v2'; // БОЕВОЙ API (не тестовый!)
const TEST_API_URL = 'https://api.edu.cdek.ru/v2'; // Для справки

/**
 * Проверяет ПВЗ через API СДЭК
 */
async function validatePvz(pvzCode: string, token: string): Promise<any> {
  try {
    const response = await fetch(
      `${CDEK_API_URL}/deliverypoints?code=${pvzCode}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      }
    );
    
    if (!response.ok) {
      console.error(`❌ PVZ validation failed for ${pvzCode}: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    console.log(`✅ PVZ ${pvzCode} validation:`, JSON.stringify(data, null, 2));
    return data;
  } catch (error) {
    console.error(`❌ Error validating PVZ ${pvzCode}:`, error);
    return null;
  }
}

/**
 * Получает информацию о заказе по UUID
 */
export async function getCdekOrderInfo(uuid: string): Promise<any> {
  try {
    const token = await getCdekToken();
    
    const response = await fetch(
      `${CDEK_API_URL}/orders/${uuid}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      }
    );
    
    const rawText = await response.text();
    console.log('📥 RAW Order Info Response:', rawText);
    
    if (!response.ok) {
      throw new Error(`Failed to get order info: ${response.status} - ${rawText}`);
    }
    
    return JSON.parse(rawText);
  } catch (error) {
    console.error('❌ Error getting CDEK order info:', error);
    throw error;
  }
}

/**
 * Создает заказ в СДЭК для розничного заказа
 */
export async function createCdekOrder(
  orderId: string,
  customerName: string,
  customerPhone: string,
  deliveryInfo: DeliveryInfo,
  items: CdekOrderItem[]
): Promise<CdekOrderResult> {
  const diagnostic: any = {
    api_host: CDEK_API_URL,
    timestamp: new Date().toISOString(),
  };
  
  try {
    console.log('========================================');
    console.log('🚚 CDEK ORDER CREATION - DIAGNOSTIC MODE');
    console.log('========================================');
    console.log('🔥 CODE VERSION: 2025-12-11 10:00 - DIMENSIONS IN CM (NOT MM) - FIXED!');
    console.log('📍 API Host:', CDEK_API_URL);
    console.log('⚠️ Test API (NOT USED):', TEST_API_URL);
    console.log('🆔 Order ID:', orderId);
    console.log('👤 Customer data received');
    console.log('📍 Delivery info received');
    console.log('📦 Items count:', items.length);
    console.log('========================================');
    
    // 1. ВАЛИДАЦИЯ ВХОДНЫХ ДАННЫХ
    if (!deliveryInfo || !deliveryInfo.pvzCode) {
      console.error('❌ VALIDATION FAILED: Missing delivery information or PVZ code');
      return {
        success: false,
        cdek_status: 'error',
        cdek_error: 'Missing delivery information or PVZ code',
        diagnostic
      };
    }
    
    if (!customerName || !customerPhone) {
      console.error('❌ VALIDATION FAILED: Missing customer information');
      return {
        success: false,
        cdek_status: 'error',
        cdek_error: 'Missing customer name or phone',
        diagnostic
      };
    }
    
    if (!items || items.length === 0) {
      console.error('❌ VALIDATION FAILED: No items in order');
      return {
        success: false,
        cdek_status: 'error',
        cdek_error: 'No items in order',
        diagnostic
      };
    }
    
    // 2. ПОЛУЧАЕМ И ПРОВЕРЯЕМ ТОКЕН
    const token = await getCdekToken();
    console.log('🔑 Token acquired (length):', token?.length || 0);
    console.log('🔑 Token preview:', token ? `${token.substring(0, 20)}...${token.substring(token.length - 10)}` : 'N/A');
    
    diagnostic.token_length = token?.length || 0;
    
    // 3. НАСТРОЙКИ КОМПАНИИ - КРИТИЧЕСКИ ВАЖНО ДЛЯ ОТОБРАЖЕНИЯ В ЛК!
    const COMPANY_NAME = 'ИП Порохина Анастасия Игоревна';
    const CONTACT_PERSON = 'Василий Нечай';
    const COMPANY_EMAIL = 'chai.nechai@yandex.ru';
    const COMPANY_PHONE = '+79818747388';
    const SENDER_OFFICE_CODE = 'SPB1204'; // ПВЗ ОТПРАВИТЕЛЯ - должен быть привязан к договору!
    const PACKAGE_COMMENT = 'Хрупкое';
    
    console.log('🏢 Company Settings:');
    console.log('  Company:', COMPANY_NAME);
    console.log('  Sender PVZ:', SENDER_OFFICE_CODE);
    
    diagnostic.sender_info = {
      company: COMPANY_NAME,
      contact: CONTACT_PERSON,
      sender_pvz: SENDER_OFFICE_CODE
    };
    
    // 4. ПРОВЕРЯЕМ ПВЗ ОТПРАВИТЕЛЯ
    console.log('🔍 Validating sender PVZ:', SENDER_OFFICE_CODE);
    const senderPvzInfo = await validatePvz(SENDER_OFFICE_CODE, token);
    diagnostic.sender_pvz_validation = senderPvzInfo;
    
    if (!senderPvzInfo) {
      console.warn('⚠️ WARNING: Sender PVZ validation failed - order may not appear in LC!');
    }
    
    // 5. ПРОВЕРЯЕМ ПВЗ ПОЛУЧАТЕЛЯ
    console.log('🔍 Validating receiver PVZ:', deliveryInfo.pvzCode);
    const receiverPvzInfo = await validatePvz(deliveryInfo.pvzCode, token);
    diagnostic.receiver_pvz_validation = receiverPvzInfo;
    
    if (!receiverPvzInfo) {
      console.warn('⚠️ WARNING: Receiver PVZ validation failed!');
    }
    
    // 6. НОРМАЛИЗУЕМ НОМЕР ТЕЛЕФОНА (СДЭК требует формат: +79001234567)
    let normalizedPhone = customerPhone.replace(/\D/g, ''); // Убираем все нечисловые символы
    if (normalizedPhone.startsWith('8')) {
      normalizedPhone = '7' + normalizedPhone.substring(1); // Заменяем 8 на 7
    }
    if (!normalizedPhone.startsWith('7')) {
      normalizedPhone = '7' + normalizedPhone; // Добавляем 7 если нет
    }
    normalizedPhone = '+' + normalizedPhone;
    console.log('📱 Phone normalized');
    
    diagnostic.phone_normalization = {
      original: customerPhone,
      normalized: normalizedPhone
    };

    // 7. РАССЧИТЫВАЕМ ГАБАРИТЫ ПОСЫЛКИ
    let totalWeight = 0;
    let maxLength = 0;
    let maxWidth = 0;
    let maxHeight = 0;

    // СОХРАНЯЕМ ВХОДЯЩИЕ ДАННЫЕ В DIAGNOSTIC
    diagnostic.incoming_items = items.map(item => ({
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      raw_weight: item.weight,
      raw_length: item.length,
      raw_width: item.width,
      raw_height: item.height
    }));
    diagnostic.code_version = '2025-12-11 10:00 - DIMENSIONS IN CM - PRODUCTION FIX';

    console.log('📦 Processing items for package dimensions:');
    items.forEach((item, index) => {
      const quantity = item.quantity || 1;
      // Дефолты для пачки кофе 200г: вес 200г, МИНИМАЛЬНЫЕ габариты 10×8×5 см
      const weight = Math.max(item.weight || 200, 100);
      const length = Math.max(item.length || 10, 5);
      const width = Math.max(item.width || 8, 5);
      const height = Math.max(item.height || 5, 3);
      
      console.log(`  Item ${index + 1}: ${item.name}`);
      console.log(`    Raw: weight=${item.weight}, L=${item.length}, W=${item.width}, H=${item.height}`);
      console.log(`    Used: weight=${weight}g, ${length}×${width}×${height} cm (×${quantity})`);
      
      totalWeight += weight * quantity;
      maxLength = Math.max(maxLength, length);
      maxWidth = Math.max(maxWidth, width);
      maxHeight = Math.max(maxHeight, height);
    });
    
    console.log(`📦 Final package: ${totalWeight}g, ${maxLength}×${maxWidth}×${maxHeight} cm`);
    
    // Минимум 1кг для тарифа 136
    if (totalWeight < 1000 && deliveryInfo.tariffCode === 136) {
      console.log(`⚠️ Tariff 136 requires min 1kg, rounding up from ${totalWeight}g to 1000g`);
      totalWeight = 1000;
    }

    // СОРТИРУЕМ ГАБАРИТЫ ПО УБЫВАНИЮ (length >= width >= height)
    // API СДЭК требует правильной сортировки для расчета объемного веса
    const dimensions = [maxLength, maxWidth, maxHeight].sort((a, b) => b - a);
    const sortedLength = dimensions[0];
    const sortedWidth = dimensions[1];
    const sortedHeight = dimensions[2];
    
    console.log(`📦 Sorting dimensions: ${maxLength}×${maxWidth}×${maxHeight} → ${sortedLength}×${sortedWidth}×${sortedHeight} cm`);

    // ⚠️ ВАЖНО: API CDEK требует габариты в САНТИМЕТРАХ (не в миллиметрах!)
    // Это подтверждено работой калькулятора (/cdek/calc) и документацией
    const lengthCm = Math.round(sortedLength);
    const widthCm = Math.round(sortedWidth);
    const heightCm = Math.round(sortedHeight);

    console.log(`📦 Package dimensions: ${totalWeight}g, ${lengthCm}×${widthCm}×${heightCm} cm`);
    console.log(`   Volumetric weight: ${Math.ceil((lengthCm * widthCm * heightCm) / 5000)}g`);
    
    diagnostic.package = {
      weight_g: totalWeight,
      dimensions_cm: { length: lengthCm, width: widthCm, height: heightCm }
    };

    // 8. ФОРМИРУЕМ ТЕЛ ЗАКАЗА
    // type: 1 = Интернет-магазин (по умолчанию)
    // ВАЖНО: если тип неверный, заказ создастся, но НЕ появится в ЛК!
    const ORDER_TYPE = 1;
    
    const cdekOrder = {
      type: ORDER_TYPE,
      number: orderId,
      tariff_code: deliveryInfo.tariffCode || 136,
      comment: PACKAGE_COMMENT,
      shipment_point: SENDER_OFFICE_CODE, // КРИТИЧНО: должен быть привязан к договору!
      delivery_point: deliveryInfo.pvzCode,
      sender: {
        company: COMPANY_NAME,
        name: CONTACT_PERSON,
        email: COMPANY_EMAIL,
        phones: [
          { number: COMPANY_PHONE }
        ]
      },
      recipient: {
        name: customerName,
        phones: [
          { number: normalizedPhone }
        ]
      },
      packages: [
        {
          number: '1',
          comment: PACKAGE_COMMENT,
          weight: totalWeight,
          length: lengthCm,
          width: widthCm,
          height: heightCm,
          items: items.map((item, index) => ({
            name: item.name || 'Товар',
            ware_key: item.id || `item_${index}`,
            payment: {
              value: 0 // Без наложенного платежа
            },
            cost: item.price || 0,
            weight: item.weight || 100,
            amount: item.quantity || 1
          }))
        }
      ]
    };

    console.log('========================================');
    console.log('📤 SENDING ORDER TO CDEK API');
    console.log('========================================');
    console.log('URL:', `${CDEK_API_URL}/orders`);
    console.log('Order type:', ORDER_TYPE, '(1=Интернет-магазин)');
    console.log('Sender PVZ:', SENDER_OFFICE_CODE);
    console.log('Receiver PVZ:', deliveryInfo.pvzCode);
    console.log('Order body:', JSON.stringify(cdekOrder, null, 2));
    console.log('========================================');
    
    diagnostic.order_body = cdekOrder;

    // 9. ОТПРАВЛЯЕМ ЗАПРОС
    const cdekResponse = await fetch(`${CDEK_API_URL}/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(cdekOrder)
    });

    console.log('📊 CDEK API Response:');
    console.log('  Status:', cdekResponse.status, cdekResponse.statusText);
    
    diagnostic.response_status = cdekResponse.status;
    diagnostic.response_status_text = cdekResponse.statusText;
    
    // 10. ПОЛЧАЕМ И ПАРСИМ RAW RESPONSE
    const rawResponseText = await cdekResponse.text();
    console.log('📥 RAW RESPONSE:', rawResponseText);
    
    diagnostic.raw_response = rawResponseText;
    
    let cdekData: any;
    try {
      cdekData = JSON.parse(rawResponseText);
    } catch (parseError) {
      console.error('❌ CRITICAL: Failed to parse JSON response!');
      console.error('Parse error:', parseError);
      return {
        success: false,
        cdek_status: 'error',
        cdek_error: 'Invalid JSON response from CDEK API',
        diagnostic
      };
    }
    
    console.log('📥 Parsed Response:', JSON.stringify(cdekData, null, 2));
    
    // 11. ПРОВЕРЯЕМ ОТВЕТ (3 УСЛОВИЯ)
    
    // Условие 1: HTTP статус должен быть OK
    if (!cdekResponse.ok) {
      console.error('❌ CONDITION 1 FAILED: HTTP status is not OK');
      console.error('Status:', cdekResponse.status, cdekResponse.statusText);
    }
    
    // Условие 2: Проверяем наличие errors в ответе
    const hasErrors = cdekData.errors && Array.isArray(cdekData.errors) && cdekData.errors.length > 0;
    if (hasErrors) {
      console.error('❌ CONDITION 2 FAILED: Response contains errors');
      console.error('Errors:', JSON.stringify(cdekData.errors, null, 2));
    }
    
    // Условие 3: Проверяем наличие entity.uuid
    const hasEntity = cdekData.entity && cdekData.entity.uuid;
    if (!hasEntity) {
      console.error('❌ CONDITION 3 FAILED: No entity.uuid in response');
      console.error('This means the order was NOT created!');
    }
    
    diagnostic.validation = {
      http_ok: cdekResponse.ok,
      has_errors: hasErrors,
      has_entity: hasEntity,
      errors: cdekData.errors,
      entity: cdekData.entity,
      requests: cdekData.requests
    };
    
    // ЕСЛИ ХОТЬ ОДНО УСЛОВИЕ НЕ ВЫПОЛНЕНО - ОШИБКА
    if (!cdekResponse.ok || hasErrors || !hasEntity) {
      console.error('========================================');
      console.error('❌ CDEK ORDER CREATION FAILED!');
      console.error('========================================');
      
      let errorMessage = 'Unknown error';
      if (cdekData.errors && Array.isArray(cdekData.errors)) {
        errorMessage = cdekData.errors.map((err: any) => {
          return err.message || err.code || JSON.stringify(err);
        }).join(', ');
      } else if (cdekData.message) {
        errorMessage = cdekData.message;
      } else if (!hasEntity) {
        errorMessage = 'No entity.uuid in response - order not created';
      }
      
      console.error('Error message:', errorMessage);
      console.error('Full response:', JSON.stringify(cdekData, null, 2));
      
      return {
        success: false,
        cdek_status: 'failed',
        cdek_error: {
          status: cdekResponse.status,
          statusText: cdekResponse.statusText,
          message: errorMessage,
          details: cdekData
        },
        diagnostic
      };
    }

    // 12. УСПЕХ - ИЗВЛЕКАЕМ ДАННЫЕ
    const uuid = cdekData.entity.uuid;
    const cdek_number = cdekData.entity.cdek_number || orderId;
    
    console.log('========================================');
    console.log('✅ CDEK ORDER CREATED SUCCESSFULLY!');
    console.log('========================================');
    console.log('UUID:', uuid);
    console.log('CDEK Number:', cdek_number);
    console.log('Entity:', JSON.stringify(cdekData.entity, null, 2));
    if (cdekData.requests) {
      console.log('Requests:', JSON.stringify(cdekData.requests, null, 2));
    }
    console.log('========================================');
    
    // 13. ПРОВЕРЯЕМ ЗАКАЗ ЧЕРЕЗ GET /orders/{uuid}
    console.log('🔍 Verifying order existence via GET /orders/' + uuid);
    try {
      const orderInfo = await getCdekOrderInfo(uuid);
      console.log('✅ Order verification successful:', JSON.stringify(orderInfo, null, 2));
      diagnostic.order_verification = orderInfo;
    } catch (verifyError) {
      console.error('⚠️ Order verification failed (but order was created):', verifyError);
      diagnostic.order_verification_error = String(verifyError);
    }
    
    console.log('========================================');
    console.log('📋 DIAGNOSTIC SUMMARY:');
    console.log('========================================');
    console.log('API Host:', diagnostic.api_host);
    console.log('Sender PVZ valid:', !!senderPvzInfo);
    console.log('Receiver PVZ valid:', !!receiverPvzInfo);
    console.log('Order UUID:', uuid);
    console.log('Order Number:', cdek_number);
    console.log('========================================');
    console.log('🎯 ORDER SHOULD NOW APPEAR IN CDEK PERSONAL CABINET');
    console.log('   Check: https://lk.cdek.ru/');
    console.log('========================================');
    
    return {
      success: true,
      cdek_uuid: uuid,
      cdek_number: cdek_number,
      cdek_status: 'created',
      cdek_data: cdekData,
      diagnostic
    };

  } catch (error) {
    console.error('========================================');
    console.error('❌ EXCEPTION DURING CDEK ORDER CREATION');
    console.error('========================================');
    console.error('Error:', error);
    console.error('Stack:', error instanceof Error ? error.stack : 'N/A');
    
    diagnostic.exception = {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    };
    
    return {
      success: false,
      cdek_status: 'error',
      cdek_error: error instanceof Error ? error.message : String(error),
      diagnostic
    };
  }
}