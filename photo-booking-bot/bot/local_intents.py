"""Rule-based admin command parser — works without OpenAI (RU VPS)."""

from __future__ import annotations

import re
from datetime import datetime

_MONTHS: list[tuple[str, int]] = [
    ("январ", 1),
    ("феврал", 2),
    ("март", 3),
    ("апрел", 4),
    ("ма", 5),
    ("июн", 6),
    ("июл", 7),
    ("август", 8),
    ("сентябр", 9),
    ("октябр", 10),
    ("ноябр", 11),
    ("декабр", 12),
]


def _intent(
    name: str,
    *,
    date: str | None = None,
    time: str | None = None,
    search: str | None = None,
) -> dict:
    return {"intent": name, "date": date, "time": time, "search": search}


def _pad_date(day: int, month: int, year: int) -> str:
    return f"{day:02d}.{month:02d}.{year}"


def _pad_time(hour: int, minute: int) -> str:
    return f"{hour:02d}:{minute:02d}"


def _extract_dot_date_time(text: str) -> tuple[str, str] | None:
    m = re.search(
        r"(\d{1,2})\.(\d{1,2})\.(\d{4})\s+(?:в\s+)?(\d{1,2})[:.](\d{2})",
        text,
    )
    if not m:
        return None
    d, mo, y, h, mi = (int(x) for x in m.groups())
    return _pad_date(d, mo, y), _pad_time(h, mi)


def _extract_russian_date_time(text: str) -> tuple[str, str] | None:
    m = re.search(
        r"(\d{1,2})\s+([а-яё]+)\w*\s+(?:(\d{4})\s+)?(?:в\s+)?(\d{1,2})[:.](\d{2})",
        text,
    )
    if not m:
        return None
    day = int(m.group(1))
    month_word = m.group(2)
    year = int(m.group(3)) if m.group(3) else datetime.now().year
    hour = int(m.group(4))
    minute = int(m.group(5))
    month = None
    for prefix, num in _MONTHS:
        if month_word.startswith(prefix):
            month = num
            break
    if month is None:
        return None
    return _pad_date(day, month, year), _pad_time(hour, minute)


def extract_slot_datetime(text: str) -> tuple[str, str] | None:
    return _extract_dot_date_time(text) or _extract_russian_date_time(text)


def parse_local_intent(text: str) -> dict | None:
    """Return intent dict if recognized locally, else None."""
    t = text.lower().strip()
    if not t:
        return None

    slot_dt = extract_slot_datetime(t)
    if slot_dt and re.search(r"(добав\w*|создай|нов\w*\s+слот|слот\s+на)", t):
        date_s, time_s = slot_dt
        return _intent("add_slot", date=date_s, time=time_s)

    if re.search(r"ожида\w*\s+оплат", t):
        return _intent("awaiting_payments")

    if re.search(r"\b(статистик\w*|аналитик\w*)", t):
        return _intent("stats")

    if re.search(r"\b(настройк\w*|цен\w*|стоимост\w*|предоплат\w*|тариф\w*)", t):
        return _intent("settings")

    if re.search(r"\b(запис\w*|брон\w*|клиент\w*)", t) and "слот" not in t:
        return _intent("list_bookings")

    if re.search(
        r"(слот\w*|свободн\w*|расписан\w*|график\w*|покаж\w*\s+.*слот|какие\s+слот)",
        t,
    ):
        return _intent("list_slots")

    return None


def format_openai_error(exc: Exception) -> str:
    msg = str(exc)
    if "unsupported_country_region_territory" in msg or "unsupported_country" in msg:
        return (
            "OpenAI недоступен с VPS в РФ без прокси.\n"
            "Добавьте OPENAI_HTTPS_PROXY в Secrets или пишите команды текстом:\n"
            "«покажи слоты», «записи», «статистика»."
        )
    if "403" in msg:
        return f"OpenAI отклонил запрос (403). Проверьте ключ и прокси.\n{msg[:120]}"
    if len(msg) > 280:
        return msg[:280] + "…"
    return msg
