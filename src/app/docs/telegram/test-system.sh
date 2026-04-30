#!/bin/bash

##############################################################################
# Скрипт для комплексного тестирования Telegram-рассылки
# 
# Использование:
#   ./test-system.sh <BOT_TOKEN> <TEST_CHAT_ID>
##############################################################################

set -e

# Цвета
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PROJECT_ID="pkhinqiplfezrzvsqgwo"
SUPABASE_URL="https://${PROJECT_ID}.supabase.co"
WEBHOOK_URL="${SUPABASE_URL}/functions/v1/telegram-webhook"

if [ -z "$1" ] || [ -z "$2" ]; then
    echo -e "${RED}❌ Ошибка: недостаточно аргументов${NC}"
    echo ""
    echo "Использование:"
    echo "  ./test-system.sh <BOT_TOKEN> <TEST_CHAT_ID>"
    echo ""
    echo "Пример:"
    echo "  ./test-system.sh 123456:ABC-DEF 987654321"
    exit 1
fi

BOT_TOKEN="$1"
TEST_CHAT_ID="$2"

echo -e "${BLUE}🧪 Комплексное тестирование Telegram-рассылки${NC}\n"

# Функция для проверки HTTP статуса
check_http() {
    local url="$1"
    local status=$(curl -s -o /dev/null -w "%{http_code}" "$url")
    echo "$status"
}

# =============================================================================
# 1. ПРОВЕРКА TELEGRAM BOT API
# =============================================================================
echo -e "${BLUE}1️⃣ Проверка доступности Telegram Bot API...${NC}"

BOT_INFO=$(curl -s "https://api.telegram.org/bot${BOT_TOKEN}/getMe")

if echo "$BOT_INFO" | grep -q '"ok":true'; then
    BOT_NAME=$(echo "$BOT_INFO" | grep -o '"username":"[^"]*"' | cut -d'"' -f4)
    echo -e "${GREEN}   ✅ Бот найден: @${BOT_NAME}${NC}"
else
    echo -e "${RED}   ❌ Не удалось получить информацию о боте${NC}"
    echo "   Проверьте токен бота"
    exit 1
fi

# =============================================================================
# 2. ПРОВЕРКА WEBHOOK
# =============================================================================
echo ""
echo -e "${BLUE}2️⃣ Проверка webhook...${NC}"

WEBHOOK_INFO=$(curl -s "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo")

if echo "$WEBHOOK_INFO" | grep -q '"ok":true'; then
    CURRENT_URL=$(echo "$WEBHOOK_INFO" | grep -o '"url":"[^"]*"' | cut -d'"' -f4)
    PENDING=$(echo "$WEBHOOK_INFO" | grep -o '"pending_update_count":[0-9]*' | cut -d':' -f2)
    
    if [ -n "$CURRENT_URL" ]; then
        if [ "$CURRENT_URL" = "$WEBHOOK_URL" ]; then
            echo -e "${GREEN}   ✅ Webhook настроен правильно${NC}"
            echo "      URL: ${CURRENT_URL}"
            echo "      Необработанных: ${PENDING:-0}"
        else
            echo -e "${YELLOW}   ⚠️  Webhook настроен на другой URL${NC}"
            echo "      Текущий: ${CURRENT_URL}"
            echo "      Ожидаемый: ${WEBHOOK_URL}"
        fi
    else
        echo -e "${RED}   ❌ Webhook не настроен${NC}"
        echo "   Запустите setup-webhook.sh для настройки"
    fi
    
    ERROR_MSG=$(echo "$WEBHOOK_INFO" | grep -o '"last_error_message":"[^"]*"' | cut -d'"' -f4)
    if [ -n "$ERROR_MSG" ]; then
        echo -e "${YELLOW}   ⚠️  Последняя ошибка: ${ERROR_MSG}${NC}"
    fi
else
    echo -e "${RED}   ❌ Не удалось получить информацию о webhook${NC}"
fi

# =============================================================================
# 3. ПРОВЕРКА EDGE FUNCTION
# =============================================================================
echo ""
echo -e "${BLUE}3️⃣ Проверка Edge Function (telegram-webhook)...${NC}"

# Проверяем доступность (должен возвращать 405 на GET запрос)
EDGE_STATUS=$(check_http "$WEBHOOK_URL")

if [ "$EDGE_STATUS" = "405" ]; then
    echo -e "${GREEN}   ✅ Edge Function доступна${NC}"
    echo "      URL: ${WEBHOOK_URL}"
elif [ "$EDGE_STATUS" = "404" ]; then
    echo -e "${RED}   ❌ Edge Function не найдена${NC}"
    echo "   Убедитесь, что функция задеплоена в Supabase"
else
    echo -e "${YELLOW}   ⚠️  Неожиданный статус: ${EDGE_STATUS}${NC}"
fi

# =============================================================================
# 4. ПРОВЕРКА HONO SERVER ENDPOINTS
# =============================================================================
echo ""
echo -e "${BLUE}4️⃣ Проверка Hono Server endpoints...${NC}"

# Проверяем endpoint информации о webhook (без ключа будет 401, но это нормально)
SERVER_WEBHOOK_INFO="${SUPABASE_URL}/functions/v1/make-server-aa167a09/telegram/webhook/info"
SERVER_STATUS=$(check_http "$SERVER_WEBHOOK_INFO")

if [ "$SERVER_STATUS" = "200" ] || [ "$SERVER_STATUS" = "401" ]; then
    echo -e "${GREEN}   ✅ Server endpoints доступны${NC}"
    echo "      Base URL: ${SUPABASE_URL}/functions/v1/make-server-aa167a09"
elif [ "$SERVER_STATUS" = "404" ]; then
    echo -e "${RED}   ❌ Server endpoints не найдены${NC}"
    echo "   Убедитесь, что сервер задеплоен"
else
    echo -e "${YELLOW}   ⚠️  Неожиданный статус: ${SERVER_STATUS}${NC}"
fi

# =============================================================================
# 5. ТЕСТИРОВАНИЕ ОТПРАВКИ СООБЩЕНИЯ
# =============================================================================
echo ""
echo -e "${BLUE}5️⃣ Тестирование отправки сообщения...${NC}"

TEST_MESSAGE="🧪 Тестовое сообщение системы рассылки\n\nВремя: $(date '+%Y-%m-%d %H:%M:%S')"

SEND_RESULT=$(curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
    -H "Content-Type: application/json" \
    -d "{
        \"chat_id\": ${TEST_CHAT_ID},
        \"text\": \"${TEST_MESSAGE}\",
        \"parse_mode\": \"HTML\"
    }")

if echo "$SEND_RESULT" | grep -q '"ok":true'; then
    echo -e "${GREEN}   ✅ Сообщение успешно отправлено${NC}"
    echo "      Chat ID: ${TEST_CHAT_ID}"
else
    ERROR=$(echo "$SEND_RESULT" | grep -o '"description":"[^"]*"' | cut -d'"' -f4)
    echo -e "${RED}   ❌ Не удалось отправить сообщение${NC}"
    if [ -n "$ERROR" ]; then
        echo "      Ошибка: ${ERROR}"
    fi
fi

# =============================================================================
# 6. РЕЗЮМЕ
# =============================================================================
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════${NC}"
echo -e "${BLUE}                  РЕЗЮМЕ                       ${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════${NC}"

echo ""
echo "Компоненты системы:"
echo ""

# Бот
if echo "$BOT_INFO" | grep -q '"ok":true'; then
    echo -e "  ${GREEN}✓${NC} Telegram Bot API"
else
    echo -e "  ${RED}✗${NC} Telegram Bot API"
fi

# Webhook
if [ "$CURRENT_URL" = "$WEBHOOK_URL" ]; then
    echo -e "  ${GREEN}✓${NC} Webhook"
else
    echo -e "  ${YELLOW}!${NC} Webhook (требуется настройка)"
fi

# Edge Function
if [ "$EDGE_STATUS" = "405" ]; then
    echo -e "  ${GREEN}✓${NC} Edge Function"
else
    echo -e "  ${RED}✗${NC} Edge Function"
fi

# Server
if [ "$SERVER_STATUS" = "200" ] || [ "$SERVER_STATUS" = "401" ]; then
    echo -e "  ${GREEN}✓${NC} Hono Server"
else
    echo -e "  ${RED}✗${NC} Hono Server"
fi

# Отправка сообщений
if echo "$SEND_RESULT" | grep -q '"ok":true'; then
    echo -e "  ${GREEN}✓${NC} Отправка сообщений"
else
    echo -e "  ${RED}✗${NC} Отправка сообщений"
fi

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════${NC}"

# =============================================================================
# 7. РЕКОМЕНДАЦИИ
# =============================================================================
echo ""
echo -e "${BLUE}📝 Рекомендации:${NC}"
echo ""

if [ "$CURRENT_URL" != "$WEBHOOK_URL" ]; then
    echo -e "  ${YELLOW}→${NC} Настройте webhook: ./setup-webhook.sh ${BOT_TOKEN:0:10}..."
fi

if [ "$EDGE_STATUS" != "405" ]; then
    echo -e "  ${YELLOW}→${NC} Проверьте деплой Edge Function в Supabase Dashboard"
fi

if [ "$SERVER_STATUS" = "404" ]; then
    echo -e "  ${YELLOW}→${NC} Проверьте деплой Hono Server в Supabase Dashboard"
fi

if ! echo "$SEND_RESULT" | grep -q '"ok":true'; then
    echo -e "  ${YELLOW}→${NC} Проверьте Chat ID и права бота"
fi

if [ -n "$ERROR_MSG" ]; then
    echo -e "  ${YELLOW}→${NC} Исправьте ошибки webhook (см. раздел 2)"
fi

# Проверяем, все ли хорошо
ALL_OK=true
if ! echo "$BOT_INFO" | grep -q '"ok":true'; then ALL_OK=false; fi
if [ "$CURRENT_URL" != "$WEBHOOK_URL" ]; then ALL_OK=false; fi
if [ "$EDGE_STATUS" != "405" ]; then ALL_OK=false; fi
if [ "$SERVER_STATUS" != "200" ] && [ "$SERVER_STATUS" != "401" ]; then ALL_OK=false; fi

if [ "$ALL_OK" = true ]; then
    echo ""
    echo -e "${GREEN}✨ Все компоненты работают! Система готова к использованию.${NC}"
else
    echo ""
    echo -e "${YELLOW}⚠️  Обнаружены проблемы. Следуйте рекомендациям выше.${NC}"
fi

echo ""
