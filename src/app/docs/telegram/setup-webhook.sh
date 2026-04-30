#!/bin/bash

##############################################################################
# Скрипт для настройки Telegram Webhook
# 
# Использование:
#   ./setup-webhook.sh <BOT_TOKEN>
# 
# Пример:
#   ./setup-webhook.sh 123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
##############################################################################

set -e

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Константы проекта
PROJECT_ID="pkhinqiplfezrzvsqgwo"
WEBHOOK_URL="https://${PROJECT_ID}.supabase.co/functions/v1/telegram-webhook"

# Проверка аргументов
if [ -z "$1" ]; then
    echo -e "${RED}❌ Ошибка: не указан токен бота${NC}"
    echo ""
    echo "Использование:"
    echo "  ./setup-webhook.sh <BOT_TOKEN>"
    echo ""
    echo "Пример:"
    echo "  ./setup-webhook.sh 123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
    exit 1
fi

BOT_TOKEN="$1"

echo -e "${BLUE}🚀 Настройка Telegram Webhook${NC}\n"
echo -e "📍 Webhook URL: ${WEBHOOK_URL}"
echo -e "🤖 Bot Token: ${BOT_TOKEN:0:10}..."
echo ""

# 1. Проверка текущего webhook
echo -e "${BLUE}1️⃣ Проверка текущего webhook...${NC}"

CURRENT_INFO=$(curl -s "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo")

if ! echo "$CURRENT_INFO" | grep -q '"ok":true'; then
    echo -e "${RED}❌ Не удалось получить информацию о webhook${NC}"
    echo "$CURRENT_INFO"
    exit 1
fi

CURRENT_URL=$(echo "$CURRENT_INFO" | grep -o '"url":"[^"]*"' | cut -d'"' -f4)

if [ -n "$CURRENT_URL" ]; then
    echo -e "   ℹ️  Текущий webhook: ${CURRENT_URL}"
    
    if [ "$CURRENT_URL" = "$WEBHOOK_URL" ]; then
        echo -e "${GREEN}   ✅ Webhook уже настроен правильно!${NC}"
        echo ""
        echo "Информация:"
        echo "$CURRENT_INFO" | grep -o '"pending_update_count":[0-9]*' | cut -d':' -f2 | xargs -I {} echo "   - Необработанных обновлений: {}"
        
        ERROR_MSG=$(echo "$CURRENT_INFO" | grep -o '"last_error_message":"[^"]*"' | cut -d'"' -f4)
        if [ -n "$ERROR_MSG" ]; then
            echo -e "${YELLOW}   - Последняя ошибка: ${ERROR_MSG}${NC}"
        fi
        exit 0
    fi
else
    echo "   ℹ️  Webhook не настроен"
fi

# 2. Установка webhook
echo ""
echo -e "${BLUE}2️⃣ Установка webhook...${NC}"

SET_RESULT=$(curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
    -H "Content-Type: application/json" \
    -d "{
        \"url\": \"${WEBHOOK_URL}\",
        \"allowed_updates\": [\"message\"]
    }")

if ! echo "$SET_RESULT" | grep -q '"ok":true'; then
    echo -e "${RED}❌ Не удалось установить webhook${NC}"
    echo "$SET_RESULT"
    exit 1
fi

echo -e "${GREEN}   ✅ Webhook успешно установлен!${NC}"

# 3. Проверка установки
echo ""
echo -e "${BLUE}3️⃣ Проверка установки...${NC}"

VERIFY_INFO=$(curl -s "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo")

if ! echo "$VERIFY_INFO" | grep -q '"ok":true'; then
    echo -e "${RED}❌ Не удалось проверить webhook${NC}"
    echo "$VERIFY_INFO"
    exit 1
fi

echo -e "${GREEN}   ✅ Проверка пройдена!${NC}"
echo ""
echo "📊 Информация о webhook:"

VERIFY_URL=$(echo "$VERIFY_INFO" | grep -o '"url":"[^"]*"' | cut -d'"' -f4)
PENDING_COUNT=$(echo "$VERIFY_INFO" | grep -o '"pending_update_count":[0-9]*' | cut -d':' -f2)
ALLOWED_UPDATES=$(echo "$VERIFY_INFO" | grep -o '"allowed_updates":\[[^\]]*\]' | sed 's/"allowed_updates"://g')

echo "   - URL: ${VERIFY_URL}"
echo "   - Необработанных обновлений: ${PENDING_COUNT}"
echo "   - Отслеживаемые события: ${ALLOWED_UPDATES}"

ERROR_MSG=$(echo "$VERIFY_INFO" | grep -o '"last_error_message":"[^"]*"' | cut -d'"' -f4)
if [ -n "$ERROR_MSG" ]; then
    echo -e "${YELLOW}   ⚠️  Последняя ошибка: ${ERROR_MSG}${NC}"
    
    ERROR_DATE=$(echo "$VERIFY_INFO" | grep -o '"last_error_date":[0-9]*' | cut -d':' -f2)
    if [ -n "$ERROR_DATE" ]; then
        FORMATTED_DATE=$(date -d "@${ERROR_DATE}" "+%Y-%m-%d %H:%M:%S" 2>/dev/null || date -r "${ERROR_DATE}" "+%Y-%m-%d %H:%M:%S" 2>/dev/null || echo "Неизвестно")
        echo "   📅 Дата ошибки: ${FORMATTED_DATE}"
    fi
fi

echo ""
echo -e "${GREEN}✨ Готово! Теперь напишите боту любое сообщение для тестирования.${NC}"
