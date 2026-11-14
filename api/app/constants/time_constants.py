"""The API's one time zone, in every environment. Postgres stores timestamptz (an absolute
instant), the database session and every timestamp on the wire use this zone, so the
API sends ISO 8601 with its offset (2026-10-31T14:30:00+05:30). Nothing reads the
server's local zone."""

from zoneinfo import ZoneInfo

APP_TIME_ZONE_NAME = "Asia/Kolkata"
APP_TIME_ZONE = ZoneInfo(APP_TIME_ZONE_NAME)
