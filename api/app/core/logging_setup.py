import logging
from datetime import datetime

from app.constants.time_constants import APP_TIME_ZONE

LOG_FORMAT = "%(asctime)s %(levelname)s %(name)s %(message)s"


class AppTimeZoneFormatter(logging.Formatter):
    """Log times in the app's zone, never the server's local zone."""

    def formatTime(self, record: logging.LogRecord, datefmt: str | None = None) -> str:  # noqa: N802 - overrides logging's name
        moment = datetime.fromtimestamp(record.created, APP_TIME_ZONE)
        return moment.strftime(datefmt) if datefmt else moment.isoformat(timespec="milliseconds")


def configure_logging(level: str) -> None:
    handler = logging.StreamHandler()
    handler.setFormatter(AppTimeZoneFormatter(LOG_FORMAT))
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(level)
