"""The only place environment variables are read. Every variable is listed in .env.example."""

from enum import StrEnum
from pathlib import Path
from typing import Annotated, Self

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

LIST_SEPARATOR = ","
ALLOWED_ORIGINS_REQUIRED = "ALLOWED_ORIGINS must list the site's origin in production."
DEMO_ACCOUNT_INCOMPLETE = "DEMO_PASSWORD and DEMO_NAME must be set when DEMO_EMAIL is."


class AppEnvironment(StrEnum):
    LOCAL = "local"
    TEST = "test"
    PRODUCTION = "production"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: AppEnvironment = AppEnvironment.LOCAL
    database_url: str
    allowed_origins: Annotated[list[str], NoDecode] = []
    cors_origins: Annotated[list[str], NoDecode] = []
    session_cookie_name: str = "notes_session"
    session_lifetime_days: int = 30
    session_cookie_secure: bool = True
    web_dist_dir: Path = Path("../web/dist")
    log_level: str = "INFO"
    # The public demo account that scripts/reset_demo.py restores every night; an empty
    # email turns the reset off.
    demo_email: str = ""
    demo_password: str = ""
    demo_name: str = ""

    @field_validator("allowed_origins", "cors_origins", mode="before")
    @classmethod
    def split_origins(cls, value: object) -> object:
        """Origins come comma-separated from the environment; a trailing slash never matches."""
        if not isinstance(value, str):
            return value
        return [origin.strip().rstrip("/") for origin in value.split(LIST_SEPARATOR) if origin.strip()]

    @model_validator(mode="after")
    def require_origins_in_production(self) -> Self:
        """Without an allowed origin every browser write would get 403, so refuse to start instead."""
        if self.is_production and not self.allowed_origins:
            raise ValueError(ALLOWED_ORIGINS_REQUIRED)
        return self

    @model_validator(mode="after")
    def require_complete_demo_account(self) -> Self:
        """A reset without a password or a name would leave the demo account unusable."""
        if self.demo_email and not (self.demo_password and self.demo_name):
            raise ValueError(DEMO_ACCOUNT_INCOMPLETE)
        return self

    @property
    def is_production(self) -> bool:
        return self.app_env is AppEnvironment.PRODUCTION
