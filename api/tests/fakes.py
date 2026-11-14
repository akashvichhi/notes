"""Stand-ins for the outside world, so tests never depend on real time."""

from datetime import UTC, datetime, timedelta

START_TIME = datetime(2026, 11, 14, 6, 30, tzinfo=UTC)


class FakeClock:
    def __init__(self, start: datetime) -> None:
        self._now = start

    def now(self) -> datetime:
        return self._now

    def advance(self, **delta: float) -> None:
        self._now += timedelta(**delta)
