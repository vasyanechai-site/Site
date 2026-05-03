import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { API_BASE_URL } from "../lib/backendConfig";
import { CdekDebugPanel } from "./debug/CdekDebugPanel";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Loader2, ArrowLeft, Send, ClipboardList } from "lucide-react";

type TelegramStatus = {
  hasToken: boolean;
  hasChatId: boolean;
  tokenLength: number;
  chatIdLength: number;
  tokenPreview: string | null;
  chatIdPreview: string | null;
  nodeEnv: string;
  outboundProxyConfigured?: boolean;
  getMe?: {
    ok?: boolean;
    http?: number;
    username?: string;
    botId?: number;
    error?: unknown;
    errorSummary?: string;
  } | null;
  hints: string[];
};

function formatJson(obj: unknown) {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
}

export function DebugPage() {
  const [section, setSection] = useState<"telegram" | "cdek">("telegram");
  const [logs, setLogs] = useState<string[]>([]);
  const [status, setStatus] = useState<TelegramStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const appendLog = useCallback((line: string) => {
    const ts = new Date().toLocaleTimeString("ru-RU", { hour12: false });
    setLogs((prev) => [...prev.slice(-300), `[${ts}] ${line}`]);
  }, []);

  const loadTelegramStatus = useCallback(async () => {
    setStatusLoading(true);
    appendLog("GET /api/debug/telegram/status …");
    try {
      const res = await fetch(`${API_BASE_URL}/debug/telegram/status`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        appendLog(`Ошибка HTTP ${res.status}: ${formatJson(data)}`);
        setStatus(null);
        return;
      }
      setStatus(data as TelegramStatus);
      appendLog(`Статус: ${formatJson(data)}`);
    } catch (e) {
      appendLog(`Сеть: ${e instanceof Error ? e.message : String(e)}`);
      setStatus(null);
    } finally {
      setStatusLoading(false);
    }
  }, [appendLog]);

  useEffect(() => {
    void loadTelegramStatus();
  }, [loadTelegramStatus]);

  const loadTelegramDns = useCallback(async () => {
    appendLog("GET /api/debug/telegram/dns …");
    try {
      const res = await fetch(`${API_BASE_URL}/debug/telegram/dns`);
      const data = await res.json().catch(() => ({}));
      appendLog(`HTTP ${res.status}: ${formatJson(data)}`);
    } catch (e) {
      appendLog(`Сеть: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [appendLog]);

  const postTelegramTest = async (path: "ping" | "wholesale-sample" | "network-probe") => {
    setActionLoading(path);
    appendLog(`POST /api/debug/telegram/${path} …`);
    try {
      const res = await fetch(`${API_BASE_URL}/debug/telegram/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      appendLog(`HTTP ${res.status}: ${formatJson(data)}`);
      if (res.ok && data && typeof data === "object") {
        const rootOk = data.ok === true;
        const inner = data.result as { ok?: boolean } | undefined;
        const innerOk = inner && inner.ok === true;
        if (path === "network-probe" && rootOk) {
          appendLog("✅ До api.telegram.org достучались. Дальше — ping / оптовый тест.");
        } else if ((path === "ping" || path === "wholesale-sample") && rootOk && innerOk) {
          appendLog("✅ Сообщение ушло в Telegram. Проверьте канал.");
        }
      }
    } catch (e) {
      appendLog(`Сеть: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" asChild>
            <Link to="/" className="gap-2 inline-flex items-center">
              <ArrowLeft className="w-4 h-4" />
              На главную
            </Link>
          </Button>
        </div>

        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Отладка</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Сервисные проверки интеграций. Разделы будут пополняться. Алиас:{" "}
            <code className="text-xs bg-muted px-1 rounded">/debag</code> →{" "}
            <code className="text-xs bg-muted px-1 rounded">/debug</code>
          </p>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-border pb-3">
          <Button
            type="button"
            variant={section === "telegram" ? "default" : "outline"}
            size="sm"
            onClick={() => setSection("telegram")}
          >
            Telegram
          </Button>
          <Button
            type="button"
            variant={section === "cdek" ? "default" : "outline"}
            size="sm"
            onClick={() => setSection("cdek")}
          >
            СДЭК
          </Button>
          <Button type="button" variant="ghost" size="sm" disabled className="text-muted-foreground">
            Точка — скоро
          </Button>
        </div>

        {section === "telegram" && (
          <div className="space-y-4">
            <Card className="p-5 space-y-4">
              <h2 className="text-lg font-medium">Telegram (заявки, заказы, тесты)</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Уведомления идут через <code className="text-xs">TELEGRAM_BOT_TOKEN</code> и{" "}
                <code className="text-xs">TELEGRAM_CHAT_ID</code> на API-сервере. Ниже — только
                маскированные подсказки и длины. Тесты ниже сразу дергают API (без отдельного секрета);
                при публичном API имеет смысл ограничить доступ к <code className="text-xs">/api/debug</code> на уровне сети.
              </p>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => void loadTelegramStatus()}
                  disabled={statusLoading}
                >
                  {statusLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Обновить статус
                </Button>
              </div>

              {status && (
                <ul className="text-sm space-y-1 font-mono bg-muted/50 rounded-lg p-3 list-none">
                  <li>token: {status.hasToken ? `да (${status.tokenLength} симв.)` : "нет"}</li>
                  <li>chat: {status.hasChatId ? `да (${status.chatIdLength} симв.)` : "нет"}</li>
                  <li>tokenPreview: {status.tokenPreview ?? "—"}</li>
                  <li>chatIdPreview: {status.chatIdPreview ?? "—"}</li>
                  <li>
                    Прокси к Telegram:{" "}
                    {status.outboundProxyConfigured ? "да (TELEGRAM_HTTPS_PROXY или HTTPS_PROXY)" : "нет"}
                  </li>
                  <li>NODE_ENV: {status.nodeEnv || "—"}</li>
                  {status.getMe != null && (
                    <li className="pt-2 border-t border-border/60 mt-2">
                      getMe:{" "}
                      {status.getMe.ok
                        ? `@${status.getMe.username ?? "?"} (id ${String(status.getMe.botId ?? "—")}, HTTP ${String(status.getMe.http ?? "—")})`
                        : `ошибка — ${formatJson(status.getMe)}`}
                    </li>
                  )}
                </ul>
              )}

              {status?.hints?.map((h) => (
                <p key={h} className="text-sm text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 rounded-lg p-3">
                  {h}
                </p>
              ))}

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void loadTelegramDns()}
                  disabled={!!actionLoading}
                >
                  DNS (A) api.telegram.org
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => void postTelegramTest("network-probe")}
                  disabled={!!actionLoading}
                  className="gap-2"
                >
                  {actionLoading === "network-probe" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : null}
                  HTTPS → api.telegram.org
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void postTelegramTest("ping")}
                  disabled={!!actionLoading}
                  className="gap-2"
                >
                  {actionLoading === "ping" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Тест: короткое сообщение
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void postTelegramTest("wholesale-sample")}
                  disabled={!!actionLoading}
                  className="gap-2"
                >
                  {actionLoading === "wholesale-sample" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ClipboardList className="w-4 h-4" />
                  )}
                  Тест: как оптовый заказ
                </Button>
              </div>
            </Card>
          </div>
        )}

        {section === "cdek" && <CdekDebugPanel appendLog={appendLog} />}

        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium">Лог</h3>
            <Button type="button" variant="ghost" size="sm" onClick={() => setLogs([])}>
              Очистить
            </Button>
          </div>
          <pre className="text-xs font-mono whitespace-pre-wrap break-words max-h-[420px] overflow-y-auto bg-muted/40 rounded-md p-3 min-h-[120px]">
            {logs.length ? logs.join("\n") : "Пока пусто."}
          </pre>
        </Card>
      </div>
    </div>
  );
}
