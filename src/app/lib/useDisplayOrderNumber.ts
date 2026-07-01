import { useEffect, useState } from 'react';
import { API_BASE_URL, API_AUTH_HEADER } from './backendConfig';
import { getDisplayOrderNumber } from './orderNumbers';

/** Резолвит публичный номер заказа по техническому id из URL (оплата, success/fail). */
export function useDisplayOrderNumber(technicalOrderId: string | null): {
  displayNumber: string;
  loading: boolean;
} {
  const [displayNumber, setDisplayNumber] = useState(technicalOrderId || '');
  const [loading, setLoading] = useState(Boolean(technicalOrderId));

  useEffect(() => {
    if (!technicalOrderId) {
      setDisplayNumber('');
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/retail/order-payment-info/${encodeURIComponent(technicalOrderId)}`,
          {
            method: 'GET',
            headers: {
              ...API_AUTH_HEADER,
              'Content-Type': 'application/json',
            },
          }
        );
        if (response.ok) {
          const info = await response.json();
          if (!cancelled) {
            setDisplayNumber(
              info.orderNumber || getDisplayOrderNumber(info) || technicalOrderId
            );
          }
        } else if (!cancelled) {
          setDisplayNumber(technicalOrderId);
        }
      } catch {
        if (!cancelled) setDisplayNumber(technicalOrderId);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [technicalOrderId]);

  return { displayNumber, loading };
}
