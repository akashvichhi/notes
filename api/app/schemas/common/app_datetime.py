from datetime import datetime
from typing import Annotated

from pydantic import PlainSerializer

from app.constants.time_constants import APP_TIME_ZONE


def to_app_time_zone(value: datetime) -> str:
    return value.astimezone(APP_TIME_ZONE).isoformat()


# Every timestamp a resource sends uses this type, so the wire always carries the app's
# zone and offset, whatever zone the value was created in.
AppDateTime = Annotated[datetime, PlainSerializer(to_app_time_zone, return_type=str)]
