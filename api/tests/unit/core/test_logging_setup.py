import logging
from datetime import UTC, datetime

from app.core.logging_setup import AppTimeZoneFormatter


def test_log_time_is_written_in_the_app_time_zone() -> None:
    record = logging.LogRecord("app", logging.INFO, __file__, 1, "message", None, None)
    record.created = datetime(2026, 1, 1, 9, 0, tzinfo=UTC).timestamp()

    formatted = AppTimeZoneFormatter().formatTime(record)

    assert formatted == "2026-01-01T14:30:00.000+05:30"
