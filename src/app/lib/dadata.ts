// Константа API ключа DaData
// В production окружении это должно быть в переменных окружения
const DADATA_API_KEY = 'c8937aa9e44939a01f263e984367681de00b8ebb';

export interface DadataCompany {
  value: string;
  unrestricted_value: string;
  data: {
    inn: string;
    ogrn: string;
    kpp: string;
    address: {
      value: string;
    };
    name: {
      full_with_opf: string;
      short_with_opf: string;
    };
    management?: {
      name: string;
      post: string;
    };
    state?: {
      status: string;
    };
    finance?: {
      income: number;
    };
  };
}

export async function searchCompanies(query: string): Promise<DadataCompany[]> {
  if (query.length < 2) {
    return [];
  }

  try {
    const response = await fetch('https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/party', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Token ${DADATA_API_KEY}`
      },
      body: JSON.stringify({
        query: query,
        count: 10
      })
    });

    if (!response.ok) {
      console.error('DaData API error:', response.status, await response.text());
      return [];
    }

    const data = await response.json();
    return data.suggestions || [];
  } catch (err) {
    console.error('Failed to fetch company suggestions:', err);
    return [];
  }
}

export interface DadataBank {
  bic: string;
  correspondent_account: string;
  name: {
    payment: string;
  };
}

export interface BankDetails {
  bik: string;
  account: string;
  bankName: string;
}

// Получение банковских реквизитов по ИНН
export async function getBankDetailsByInn(inn: string): Promise<BankDetails | null> {
  if (!inn) {
    return null;
  }

  try {
    // Сначала получаем полную информацию о компании по ИНН
    const response = await fetch('https://suggestions.dadata.ru/suggestions/api/4_1/rs/findById/party', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Token ${DADATA_API_KEY}`
      },
      body: JSON.stringify({
        query: inn,
        count: 1
      })
    });

    if (!response.ok) {
      console.error('DaData findById API error:', response.status, await response.text());
      return null;
    }

    const data = await response.json();
    const company = data.suggestions?.[0];
    
    if (!company) {
      return null;
    }

    // Пытаемся извлечь банковские реквизиты (могут быть в разных форматах)
    // К сожалению, DaData API не всегда возвращает банковские реквизиты в бесплатной версии
    // Возвращаем пустые значения, которые пользователь сможет заполнить вручную
    return {
      bik: '',
      account: '',
      bankName: ''
    };
  } catch (err) {
    console.error('Failed to fetch bank details:', err);
    return null;
  }
}