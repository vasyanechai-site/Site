// CDEK Authentication Module
// Manages OAuth token for CDEK API

const CDEK_API_URL = 'https://api.cdek.ru/v2'; // БОЕВОЙ API (не тестовый!)
const CDEK_TEST_API_URL = 'https://api.edu.cdek.ru/v2'; // Тестовый API (НЕ ИСПОЛЬЗУЕТСЯ)

const CDEK_ACCOUNT = 'SfawnTZsXAEonuo4dxdAqhUnoOpNNlG1';
const CDEK_SECRET = 'csLlPSGxffhgyd7SToZo4iS4phpfVEBT';

// Логируем конфигурацию при загрузке модуля
console.log('========================================');
console.log('🔧 CDEK AUTH MODULE CONFIGURATION');
console.log('========================================');
console.log('API URL (PRODUCTION):', CDEK_API_URL);
console.log('Test API (NOT USED):', CDEK_TEST_API_URL);
console.log('Client ID:', CDEK_ACCOUNT.substring(0, 3) + '...' + CDEK_ACCOUNT.substring(CDEK_ACCOUNT.length - 3));
console.log('Secret (masked):', CDEK_SECRET.substring(0, 3) + '...' + CDEK_SECRET.substring(CDEK_SECRET.length - 3));
console.log('========================================');

let cachedToken: string | null = null;
let tokenExpiry: number = 0;

export async function getCdekToken(): Promise<string> {
  // Return cached token if still valid
  if (cachedToken && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  // Request new token
  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: CDEK_ACCOUNT,
    client_secret: CDEK_SECRET,
  });

  try {
    const response = await fetch(`${CDEK_API_URL}/oauth/token?${params.toString()}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('CDEK token error:', errorText);
      throw new Error(`Failed to get CDEK token: ${response.status}`);
    }

    const data = await response.json();
    cachedToken = data.access_token;
    // Token expires in data.expires_in seconds, cache for slightly less time
    tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;

    return cachedToken;
  } catch (error) {
    console.error('Error getting CDEK token:', error);
    throw error;
  }
}

export async function cdekRequest(
  endpoint: string,
  options: RequestInit = {}
): Promise<any> {
  const token = await getCdekToken();

  const response = await fetch(`${CDEK_API_URL}${endpoint}`, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`CDEK API error for ${endpoint}:`, response.status, errorText);
    throw new Error(`CDEK API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}