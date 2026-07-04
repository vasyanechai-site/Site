"""OpenAI Whisper + intent parsing for admin voice commands."""

from __future__ import annotations

import io
import json
import logging
import os
from datetime import datetime

import httpx
from openai import OpenAI

logger = logging.getLogger(__name__)

INTENT_PROMPT = """Ты парсер команд администратора фотостудии. Верни только JSON без markdown.
Сегодня: {today}. Текущий год: {year}.

Поля:
- intent: one of add_slot, list_slots, list_bookings, stats, settings, awaiting_payments, unknown
- date: "ДД.ММ.ГГГГ" or null
- time: "ЧЧ:ММ" or null
- search: string or null

Примеры:
"добавь слот 25 июля в 15:00" -> {{"intent":"add_slot","date":"25.07.{year}","time":"15:00","search":null}}
"покажи записи" -> {{"intent":"list_bookings","date":null,"time":null,"search":null}}
"статистика" -> {{"intent":"stats","date":null,"time":null,"search":null}}
"ожидают оплату" -> {{"intent":"awaiting_payments","date":null,"time":null,"search":null}}
"""


def _resolve_proxy(https_proxy: str | None) -> str | None:
    for candidate in (
        os.getenv("OPENAI_HTTPS_PROXY", "").strip(),
        https_proxy or "",
        os.getenv("HTTPS_PROXY", "").strip(),
        os.getenv("HTTP_PROXY", "").strip(),
    ):
        if candidate:
            return candidate
    return None


def build_openai_client(api_key: str, https_proxy: str | None = None) -> OpenAI:
    proxy = _resolve_proxy(https_proxy)
    timeout = httpx.Timeout(30.0, connect=10.0)
    if proxy:
        safe = proxy.split("@")[-1]
        logger.info("OpenAI HTTP client via proxy (%s)", safe[:80])
        http_client = httpx.Client(proxy=proxy, timeout=timeout)
    else:
        logger.warning("OpenAI HTTP client without proxy (may be unreachable from RU VPS)")
        http_client = httpx.Client(timeout=timeout)
    return OpenAI(api_key=api_key, http_client=http_client)


def transcribe(client: OpenAI, audio_bytes: bytes) -> str:
    buf = io.BytesIO(audio_bytes)
    buf.name = "voice.ogg"
    result = client.audio.transcriptions.create(
        model="whisper-1",
        file=buf,
        language="ru",
    )
    return (result.text or "").strip()


def parse_intent(client: OpenAI, text: str) -> dict:
    now = datetime.now()
    prompt = INTENT_PROMPT.format(
        year=now.year,
        today=now.strftime("%d.%m.%Y"),
    )
    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": prompt},
            {"role": "user", "content": text},
        ],
        temperature=0,
        response_format={"type": "json_object"},
    )
    raw = resp.choices[0].message.content or "{}"
    return json.loads(raw)


def parse_text_intent(api_key: str, text: str, https_proxy: str | None) -> dict:
    client = build_openai_client(api_key, https_proxy)
    return parse_intent(client, text)


def process_voice(
    api_key: str,
    audio_bytes: bytes,
    https_proxy: str | None,
) -> tuple[str, dict]:
    client = build_openai_client(api_key, https_proxy)
    text = transcribe(client, audio_bytes)
    if not text:
        return "", {"intent": "unknown", "date": None, "time": None, "search": None}
    intent_data = parse_intent(client, text)
    return text, intent_data


def ping_openai(api_key: str, https_proxy: str | None) -> None:
    """Raise on connectivity/auth failure."""
    client = build_openai_client(api_key, https_proxy)
    client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": "ping"}],
        max_tokens=2,
    )
