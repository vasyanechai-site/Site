import { API_BASE_URL } from './backendConfig';

export function formatTochkaRetailersJson(obj: unknown): string {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
}

export type TochkaRetailersDebugPayload = {
  ok?: boolean;
  http?: number;
  requestUrl?: string;
  summary?: Array<{
    name?: string;
    merchantId?: string;
    terminalId?: string;
    status?: string;
    isActive?: unknown;
  }>;
  raw?: unknown;
  error?: string;
  hint?: string;
};

/** GET /api/debug/tochka/retailers — то же, что кнопка на /debug и /tochka-diagnostics. */
export async function getTochkaDebugRetailers(): Promise<{
  httpStatus: number;
  data: TochkaRetailersDebugPayload;
}> {
  const res = await fetch(`${API_BASE_URL}/debug/tochka/retailers`);
  const data = (await res.json().catch(() => ({}))) as TochkaRetailersDebugPayload;
  return { httpStatus: res.status, data };
}

/** Строки для лога /debug (по одной на appendLog). */
export function logLinesForRetailersResponse(httpStatus: number, data: TochkaRetailersDebugPayload): string[] {
  const lines: string[] = [`GET /api/debug/tochka/retailers → HTTP ${httpStatus}`, formatTochkaRetailersJson(data)];
  if (typeof data.hint === 'string' && data.hint.trim()) lines.push(data.hint.trim());
  const summary = Array.isArray(data.summary) ? data.summary : [];
  if (summary.length > 0) {
    lines.push('Кратко (скопируйте terminalId в TOCHKA_TERMINAL_ID для нужного merchantId):');
    for (const row of summary) {
      lines.push(
        `  • ${row.name?.trim() || 'без названия'} | merchantId=${row.merchantId ?? '—'} | terminalId=${row.terminalId ?? '—'} | status=${row.status ?? '—'} | isActive=${String(row.isActive ?? '—')}`,
      );
    }
  } else if (data.ok !== false && httpStatus < 400) {
    lines.push('В ответе не найдено пар merchantId+terminalId — смотрите поле raw в JSON выше.');
  }
  return lines;
}
