from aiogram.types import CallbackQuery, InlineKeyboardButton, InlineKeyboardMarkup

from bot.utils import BookingStatus, SlotStatus


def admin_main_menu_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="📅 Слоты", callback_data="adm:slot:menu"),
                InlineKeyboardButton(text="📋 Записи", callback_data="adm:book:menu"),
            ],
            [
                InlineKeyboardButton(text="💳 Оплаты", callback_data="adm:pay:menu"),
                InlineKeyboardButton(text="📊 Аналитика", callback_data="adm:stats"),
            ],
            [InlineKeyboardButton(text="⚙️ Настройки", callback_data="adm:settings:menu")],
        ]
    )


def admin_back_kb(target: str = "adm:menu") -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[[InlineKeyboardButton(text="← Назад", callback_data=target)]]
    )


def admin_slots_menu_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="Все", callback_data="adm:slot:list:all"),
                InlineKeyboardButton(text="Свободные", callback_data="adm:slot:list:available"),
                InlineKeyboardButton(text="Занятые", callback_data="adm:slot:list:occupied"),
            ],
            [
                InlineKeyboardButton(text="➕ Добавить слот", callback_data="adm:slot:add"),
                InlineKeyboardButton(text="📦 Пакетом", callback_data="adm:slot:bulk"),
            ],
            [
                InlineKeyboardButton(text="🗑 Удалить", callback_data="adm:slot:delete"),
                InlineKeyboardButton(text="🕐 Перенести время", callback_data="adm:slot:reschedule"),
            ],
            [InlineKeyboardButton(text="← В админку", callback_data="adm:menu")],
        ]
    )


def admin_slot_list_kb(slots, *, list_filter: str) -> InlineKeyboardMarkup:
    rows = []
    for slot in slots[:20]:
        label = f"{slot.slot_at.strftime('%d.%m %H:%M')} — {slot.status.label_ru}"
        rows.append(
            [
                InlineKeyboardButton(
                    text=label,
                    callback_data=f"adm:slot:view:{slot.id}",
                )
            ]
        )
    rows.append(
        [InlineKeyboardButton(text="← Слоты", callback_data="adm:slot:menu")]
    )
    return InlineKeyboardMarkup(inline_keyboard=rows or [[InlineKeyboardButton(text="Пусто", callback_data="noop")]])


def admin_slot_actions_kb(slot_id: int, *, can_delete: bool, can_reschedule: bool) -> InlineKeyboardMarkup:
    rows: list[list[InlineKeyboardButton]] = []
    if can_delete:
        rows.append(
            [InlineKeyboardButton(text="🗑 Удалить", callback_data=f"adm:slot:del:{slot_id}")]
        )
    if can_reschedule:
        rows.append(
            [InlineKeyboardButton(text="🕐 Новое время", callback_data=f"adm:slot:move:{slot_id}")]
        )
    rows.append([InlineKeyboardButton(text="← Слоты", callback_data="adm:slot:menu")])
    return InlineKeyboardMarkup(inline_keyboard=rows)


def admin_dates_kb(dates, prefix: str = "adm:slot:date") -> InlineKeyboardMarkup:
    rows = [
        [InlineKeyboardButton(text=d.strftime("%d.%m.%Y"), callback_data=f"{prefix}:{d.strftime('%d.%m.%Y')}")]
        for d in dates[:14]
    ]
    rows.append([InlineKeyboardButton(text="Отмена", callback_data="adm:slot:menu")])
    return InlineKeyboardMarkup(inline_keyboard=rows or [[InlineKeyboardButton(text="Нет дат", callback_data="noop")]])


def admin_times_kb(slots, prefix: str, *, back: str) -> InlineKeyboardMarkup:
    rows = [
        [InlineKeyboardButton(text=s.slot_at.strftime("%H:%M"), callback_data=f"{prefix}:{s.id}")]
        for s in slots
    ]
    rows.append(
        [
            InlineKeyboardButton(text="← Дата", callback_data=back),
            InlineKeyboardButton(text="Отмена", callback_data="adm:slot:menu"),
        ]
    )
    return InlineKeyboardMarkup(inline_keyboard=rows or [[InlineKeyboardButton(text="Нет времени", callback_data="noop")]])


def admin_bookings_menu_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="Будущие", callback_data="adm:book:list:future"),
                InlineKeyboardButton(text="Прошлые", callback_data="adm:book:list:past"),
            ],
            [
                InlineKeyboardButton(text="Все", callback_data="adm:book:list:all"),
                InlineKeyboardButton(text="🔍 Поиск", callback_data="adm:book:search"),
            ],
            [InlineKeyboardButton(text="← В админку", callback_data="adm:menu")],
        ]
    )


def admin_bookings_list_kb(bookings) -> InlineKeyboardMarkup:
    rows = []
    for b in bookings[:15]:
        name = b.telegram_first_name or "—"
        label = f"{b.slot_at.strftime('%d.%m %H:%M')} — {name} ({b.status.label_ru})"
        rows.append(
            [InlineKeyboardButton(text=label, callback_data=f"adm:book:view:{b.id}")]
        )
    rows.append([InlineKeyboardButton(text="← Записи", callback_data="adm:book:menu")])
    return InlineKeyboardMarkup(inline_keyboard=rows or [[InlineKeyboardButton(text="Пусто", callback_data="noop")]])


def admin_booking_card_kb(booking_id: int, current_status: BookingStatus) -> InlineKeyboardMarkup:
    status_buttons = []
    transitions = [
        (BookingStatus.AWAITING_PAYMENT, "Ожидает оплату"),
        (BookingStatus.PREPAID, "Предоплата"),
        (BookingStatus.PAID_FULL, "Оплачено"),
        (BookingStatus.CANCELLED, "Отменить"),
    ]
    for status, label in transitions:
        if status != current_status:
            status_buttons.append(
                InlineKeyboardButton(
                    text=label,
                    callback_data=f"adm:book:status:{booking_id}:{status.value}",
                )
            )
    rows = [status_buttons[i : i + 2] for i in range(0, len(status_buttons), 2)]
    rows.append(
        [InlineKeyboardButton(text="💬 Комментарий", callback_data=f"adm:book:comment:{booking_id}")]
    )
    rows.append([InlineKeyboardButton(text="← Записи", callback_data="adm:book:menu")])
    return InlineKeyboardMarkup(inline_keyboard=rows)


def admin_payments_menu_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="Ожидают оплату",
                    callback_data=f"adm:pay:list:{BookingStatus.AWAITING_PAYMENT.value}",
                ),
            ],
            [
                InlineKeyboardButton(
                    text="Предоплата внесена",
                    callback_data=f"adm:pay:list:{BookingStatus.PREPAID.value}",
                ),
            ],
            [
                InlineKeyboardButton(
                    text="Оплачено полностью",
                    callback_data=f"adm:pay:list:{BookingStatus.PAID_FULL.value}",
                ),
            ],
            [InlineKeyboardButton(text="← В админку", callback_data="adm:menu")],
        ]
    )


def admin_settings_menu_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="💰 Цена", callback_data="adm:settings:price")],
            [InlineKeyboardButton(text="📊 % предоплаты", callback_data="adm:settings:prepay")],
            [InlineKeyboardButton(text="📞 Телефон СБП", callback_data="adm:settings:phone")],
            [InlineKeyboardButton(text="👤 Получатель", callback_data="adm:settings:recipient")],
            [InlineKeyboardButton(text="← В админку", callback_data="adm:menu")],
        ]
    )


def admin_cancel_kb(back: str = "adm:menu") -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[[InlineKeyboardButton(text="Отмена", callback_data=back)]]
    )
