from datetime import UTC, datetime

from pydantic import BaseModel

from app.schemas.common.app_datetime import AppDateTime


class Stamped(BaseModel):
    updated_at: AppDateTime


def test_timestamps_leave_the_api_in_the_app_time_zone_with_its_offset() -> None:
    stamped = Stamped(updated_at=datetime(2026, 10, 31, 9, 0, tzinfo=UTC))

    assert stamped.model_dump(mode="json") == {"updated_at": "2026-10-31T14:30:00+05:30"}
