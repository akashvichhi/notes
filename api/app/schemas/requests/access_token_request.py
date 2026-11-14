from typing import Annotated

from pydantic import AfterValidator, BaseModel, Field, StringConstraints
from pydantic_core import PydanticCustomError

from app.constants import messages
from app.constants.access_token_constants import (
    ACCESS_TOKEN_NAME_MAX_LENGTH,
    AccessTokenExpiryDays,
    TokenAbility,
)
from app.schemas.common.field_types import require_text

_KNOWN_ABILITIES = {ability.value for ability in TokenAbility}


def _normalise_abilities(abilities: list[str]) -> list[str]:
    """Checked as a whole list, so an error is reported on "abilities" itself. Write
    implies read, and the result follows the enum's order."""
    wanted = set(abilities)
    if not wanted <= _KNOWN_ABILITIES:
        raise PydanticCustomError("enum", "unknown ability")
    if len(wanted) != len(abilities):
        raise PydanticCustomError("abilities_distinct", messages.ABILITIES_DISTINCT)
    if TokenAbility.WRITE in wanted:
        wanted.add(TokenAbility.READ)
    return [ability.value for ability in TokenAbility if ability in wanted]


class CreateAccessTokenRequest(BaseModel):
    name: Annotated[
        str,
        StringConstraints(strip_whitespace=True, max_length=ACCESS_TOKEN_NAME_MAX_LENGTH),
        AfterValidator(require_text),
    ]
    abilities: Annotated[list[str], Field(min_length=1), AfterValidator(_normalise_abilities)]
    # Left out or null: the token never expires.
    expires_in_days: AccessTokenExpiryDays | None = None
