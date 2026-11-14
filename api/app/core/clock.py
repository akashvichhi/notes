from datetime import datetime
from typing import Protocol

from app.constants.time_constants import APP_TIME_ZONE


class Clock(Protocol):
    def now(self) -> datetime: ...


class SystemClock:
    """The real time, in the app's zone. Everything that needs "now" gets a Clock passed in,
    so tests can control time."""

    def now(self) -> datetime:
        return datetime.now(APP_TIME_ZONE)
