// Tochka Bank Payment Integration
// API Documentation: https://developers.tochka.com/

/**
 * Получает настройки Tochka Bank из переменных окружения
 */
export function getTochkaConfig(): { customerCode: string; signSecret: string; jwtToken: string } {
  const jwtToken = Deno.env.get('TOCHKA_JWT_TOKEN');
  const customerCode = Deno.env.get('TOCHKA_CUSTOMER_CODE');
  const signSecret = Deno.env.get('TOCHKA_SIGN_SECRET');
  
  if (!jwtToken) {
    throw new Error('TOCHKA_JWT_TOKEN not configured in environment variables');
  }
  
  if (!customerCode) {
    throw new Error('TOCHKA_CUSTOMER_CODE not configured in environment variables');
  }
  
  if (!signSecret) {
    throw new Error('TOCHKA_SIGN_SECRET not configured in environment variables');
  }
  
  // API требует customerCode максимум 9 символов
  let validCustomerCode = customerCode;
  if (customerCode.length > 9) {
    validCustomerCode = customerCode.substring(0, 9);
    console.warn(`⚠️ customerCode обрезан: "${customerCode}" -> "${validCustomerCode}" (макс. 9 символов)`);
  }
  
  console.log('🔧 Tochka Config:', {
    originalCustomerCode: customerCode,
    usedCustomerCode: validCustomerCode,
    customerCodeLength: validCustomerCode.length,
    signSecretLength: signSecret.length,
    jwtTokenLength: jwtToken.length,
    jwtTokenPreview: jwtToken.substring(0, 20) + '...'
  });
  
  return { customerCode: validCustomerCode, signSecret, jwtToken };
}

/**
 * Интерфейс для создания платежа
 */
export interface CreatePaymentRequest {
  amount: string; // Сумма в рублях (например, "1500.00")
  purpose: string; // Назначение платежа
  paymentMode: 'card' | 'sbp' | 'tinkoff'; // Способ оплаты
  customerCode?: string; // Код клиента (опционально)
  requestId?: string; // Уникальный ID запроса
}

/**
 * Интерфейс ответа от Tochka API при создании платежа
 */
export interface CreatePaymentResponse {
  requestId: string;
  paymentUrl: string;
  qrCode?: string;
  status: string;
}

/**
 * Создает подпись для запроса к Tochka API
 */
async function createSignature(data: string, secret: string): Promise<string> {
  // Используем HMAC-SHA256 для подписи
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(data);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  
  // Конвертируем в hex
  const hashArray = Array.from(new Uint8Array(signature));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return hashHex;
}

/**
 * Создает платеж в Tochka Bank
 */
export async function createTochkaPayment(
  params: CreatePaymentRequest
): Promise<CreatePaymentResponse> {
  const { customerCode, signSecret, jwtToken } = getTochkaConfig();

  // Генерируем уникальный requestId, если не передан
  const requestId = params.requestId || `PAY-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  // Формируем тело запроса согласно документации Точка API
  const requestBody = {
    Data: {
      customerCode,
      amount: params.amount,
      purpose: params.purpose,
      paymentMode: [params.paymentMode], // Массив способов оплаты
      requestId,
      currency: 'RUB',
      language: 'RU',
      // Настройки для чеков (ФФД)
      tax: 'none', // Без НДС
      taxation: 'osn' // Общая система налогообложения
    }
  };

  console.log('========================================');
  console.log('📤 Creating Tochka payment:');
  console.log('Customer Code:', customerCode);
  console.log('Request Body:', JSON.stringify(requestBody, null, 2));

  // Создаем подпись запроса
  const dataToSign = JSON.stringify(requestBody.Data);
  const signature = await createSignature(dataToSign, signSecret);
  
  console.log('🔐 Data to sign:', dataToSign);
  console.log('🔐 Sign secret length:', signSecret.length);
  console.log('🔐 Request signature (full):', signature);
  console.log('========================================');

  const response = await fetch('https://enter.tochka.com/uapi/acquiring/v1.0/payments', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${jwtToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Sign': signature // 🔥 ДОБАВЛЯЕМ ПОДПИСЬ В ЗАГОЛОВОК!
    },
    body: JSON.stringify(requestBody)
  });

  console.log('========================================');
  console.log('📡 RESPONSE FROM TOCHKA API:');
  console.log('Status:', response.status, response.statusText);
  console.log('Headers:', JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2));
  console.log('========================================');

  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ Tochka payment creation failed:', errorText);
    throw new Error(`Failed to create payment: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  console.log('✅ TOCHKA API RESPONSE:', JSON.stringify(data, null, 2));
  
  // Извлекаем paymentUrl из разных возможных полей
  const paymentUrl = data.paymentUrl || 
                     data.payment_url || 
                     data.Data?.paymentUrl || 
                     data.Data?.payment_url ||
                     data.url ||
                     data.link ||
                     '';

  console.log('🔍 Extracted paymentUrl:', paymentUrl || '(EMPTY!)');

  return {
    requestId: data.requestId || data.Data?.requestId || requestId,
    paymentUrl: paymentUrl,
    qrCode: data.qrCode || data.qr_code || data.Data?.qrCode,
    status: data.status || data.Data?.status || 'pending'
  };
}

/**
 * Получает статус плаежа по requestId
 */
export async function getTochkaPaymentStatus(requestId: string): Promise<{
  status: 'paid' | 'pending' | 'failed' | 'cancelled';
  amount?: string;
  paymentDate?: string;
  details?: any;
}> {
  const { customerCode, signSecret, jwtToken } = getTochkaConfig();

  console.log('========================================');
  console.log('🔍 Checking Tochka payment status for requestId:', requestId);

  const response = await fetch(
    `https://enter.tochka.com/uapi/acquiring/v1.0/payments/status/${requestId}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${jwtToken}`,
        'Accept': 'application/json'
      }
    }
  );

  console.log('📡 Response status:', response.status, response.statusText);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ Failed to get payment status:', errorText);
    console.error('========================================');
    throw new Error(`Failed to get payment status: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  console.log('✅ Payment status response:', JSON.stringify(data, null, 2));

  // Маппинг статусов из Tochka API
  // Проверяем разные возможные поля
  const statusField = data.status || data.Data?.status || data.paymentStatus || '';
  const apiStatus = statusField.toLowerCase();
  
  console.log('📊 Extracted status field:', statusField, '(lowercase:', apiStatus, ')');
  
  let status: 'paid' | 'pending' | 'failed' | 'cancelled' = 'pending';
  
  if (apiStatus === 'paid' || apiStatus === 'success' || apiStatus === 'completed' || apiStatus === 'authorized') {
    status = 'paid';
  } else if (apiStatus === 'failed' || apiStatus === 'error') {
    status = 'failed';
  } else if (apiStatus === 'cancelled' || apiStatus === 'canceled') {
    status = 'cancelled';
  }

  console.log('✅ Mapped status:', status);
  console.log('========================================');

  return {
    status,
    amount: data.amount || data.Data?.amount,
    paymentDate: data.paymentDate || data.payment_date || data.Data?.paymentDate,
    details: data
  };
}

/**
 * Интерфейс для создания платежа с чеком
 */
export interface CreatePaymentWithReceiptRequest {
  customerCode: string;
  merchantId: string;
  amount: string;
  purpose: string;
  redirectUrl: string;
  failRedirectUrl: string;
  paymentMode: string[];
  taxSystemCode: string;
  client: {
    name: string;
    email: string;
    phone: string;
  };
  items: Array<{
    name: string;
    amount: string;
    quantity: number;
    vatType: string;
    paymentMethod: string;
    paymentObject: string;
    measure: string;
  }>;
  supplier: {
    name: string;
    phone: string;
    taxCode: string;
  };
}

/**
 * Создает платеж с чеком в Tochka Bank
 */
export async function createTochkaPaymentWithReceipt(
  params: CreatePaymentWithReceiptRequest
): Promise<{ paymentLink: string; operationId: string }> {
  console.log('🔧 Checking Tochka configuration...');
  
  // Получаем токен напрямую, так как для этого метода подпись не нужна (согласно промпту)
  const jwtToken = Deno.env.get('TOCHKA_JWT_TOKEN');
  
  if (!jwtToken) {
    console.error('❌ TOCHKA_JWT_TOKEN not found in environment variables!');
    throw new Error('TOCHKA_JWT_TOKEN not configured');
  }
  
  console.log('✅ TOCHKA_JWT_TOKEN found, length:', jwtToken.length);
  console.log('Token preview:', jwtToken.substring(0, 20) + '...');

  // Валидация входных параметров
  console.log('🔍 Validating payment parameters...');
  console.log('Received params:', {
    amount: params.amount,
    customerCode: params.customerCode,
    merchantId: params.merchantId,
    client: {
      name: params.client?.name,
      email: params.client?.email,
      phone: params.client?.phone
    },
    itemsCount: params.items?.length
  });
  
  if (!params.amount || parseFloat(params.amount) <= 0) {
    throw new Error(`Invalid amount: ${params.amount}`);
  }
  
  // Очищаем телефон от форматирования и проверяем длину
  const cleanPhone = params.client?.phone ? params.client.phone.replace(/\D/g, '') : '';
  if (!cleanPhone || cleanPhone.length < 10) {
    throw new Error(`Invalid phone number: ${params.client?.phone} (cleaned: ${cleanPhone})`);
  }
  
  // Форматируем телефон: если начинается с 8, заменяем на 7
  let formattedPhone = cleanPhone;
  if (formattedPhone.startsWith('8') && formattedPhone.length === 11) {
    formattedPhone = '7' + formattedPhone.substring(1);
  } else if (!formattedPhone.startsWith('7') && formattedPhone.length === 10) {
    formattedPhone = '7' + formattedPhone;
  }
  
  console.log('📱 Phone formatting:', {
    original: params.client?.phone,
    cleaned: cleanPhone,
    formatted: formattedPhone
  });
  
  if (!params.items || params.items.length === 0) {
    throw new Error('No items in payment request');
  }
  console.log('✅ Payment parameters valid');

  // Формируем тело запроса строго по спецификации
  const requestBody = {
    Data: {
      customerCode: params.customerCode,
      merchantId: params.merchantId,
      amount: params.amount,
      purpose: params.purpose,
      redirectUrl: params.redirectUrl,
      failRedirectUrl: params.failRedirectUrl,
      paymentMode: params.paymentMode,
      taxSystemCode: params.taxSystemCode,
      Client: {
        name: params.client.name,
        email: params.client.email,
        phone: formattedPhone
      },
      Items: params.items.map(item => ({
        name: item.name,
        amount: item.amount,
        quantity: item.quantity,
        vatType: item.vatType,
        paymentMethod: item.paymentMethod,
        paymentObject: item.paymentObject,
        measure: item.measure
      })),
      Supplier: {
        name: params.supplier.name,
        phone: params.supplier.phone,
        taxCode: params.supplier.taxCode
      }
    }
  };

  console.log('========================================');
  console.log('📤 Creating Tochka payment with receipt:');
  console.log('Request Body:', JSON.stringify(requestBody, null, 2));
  console.log('========================================');

  const response = await fetch('https://enter.tochka.com/uapi/acquiring/v1.0/payments_with_receipt', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${jwtToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  console.log('📡 Response status:', response.status, response.statusText);
  console.log('📡 Response headers:', JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2));

  if (!response.ok) {
    const errorText = await response.text();
    console.error('========================================');
    console.error('❌ Tochka payment with receipt creation failed!');
    console.error('Status code:', response.status);
    console.error('Status text:', response.statusText);
    console.error('Error response body:', errorText);
    console.error('Request was:', JSON.stringify(requestBody, null, 2));
    console.error('========================================');
    throw new Error(`Failed to create payment: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  console.log('========================================');
  console.log('✅ TOCHKA API RESPONSE:');
  console.log(JSON.stringify(data, null, 2));
  console.log('========================================');

  // Извлекаем ссылку и ID операции
  const responseData = data.Data || data;
  
  if (!responseData.paymentLink) {
    throw new Error('Payment link not found in response');
  }

  return {
    paymentLink: responseData.paymentLink,
    operationId: responseData.operationId || responseData.uuid || ''
  };
}

/**
 * Обрабатывает webhook от Tochka Bank
 */
export interface TochkaWebhookPayload {
  requestId: string;
  status: string;
  amount?: string;
  paymentDate?: string;
  [key: string]: any;
}

export function processTochkaWebhook(payload: TochkaWebhookPayload): {
  requestId: string;
  status: 'paid' | 'pending' | 'failed' | 'cancelled';
  amount?: string;
  paymentDate?: string;
} {
  console.log('Processing Tochka webhook:', payload);

  // Маппинг статусов
  let status: 'paid' | 'pending' | 'failed' | 'cancelled' = 'pending';
  
  const apiStatus = (payload.status || '').toLowerCase();
  if (apiStatus === 'paid' || apiStatus === 'success' || apiStatus === 'completed') {
    status = 'paid';
  } else if (apiStatus === 'failed' || apiStatus === 'error') {
    status = 'failed';
  } else if (apiStatus === 'cancelled' || apiStatus === 'canceled') {
    status = 'cancelled';
  }

  return {
    requestId: payload.requestId,
    status,
    amount: payload.amount,
    paymentDate: payload.paymentDate || payload.payment_date
  };
}