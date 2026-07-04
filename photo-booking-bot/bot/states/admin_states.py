from aiogram.fsm.state import State, StatesGroup


class AddSlotStates(StatesGroup):
    choosing_date = State()
    choosing_time = State()
    bulk_lines = State()


class RescheduleSlotStates(StatesGroup):
    choosing_date = State()
    choosing_time = State()


class EditSettingsStates(StatesGroup):
    waiting_price = State()
    waiting_prepay = State()
    waiting_phone = State()
    waiting_recipient = State()


class BookingSearchStates(StatesGroup):
    waiting_query = State()


class BookingCommentStates(StatesGroup):
    waiting_comment = State()
