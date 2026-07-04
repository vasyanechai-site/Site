from aiogram.fsm.state import State, StatesGroup


class AddSlotsState(StatesGroup):
    waiting_for_lines = State()
