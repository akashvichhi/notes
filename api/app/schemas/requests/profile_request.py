from typing import Annotated

from pydantic import BaseModel, StrictBool

from app.constants.note_constants import NoteSort
from app.constants.preference_constants import Theme
from app.schemas.common.field_types import Email, GivenPassword, NotNull, UserName
from app.schemas.requests.auth_request import NewPasswordFields


class UpdateProfileRequest(BaseModel):
    name: Annotated[UserName | None, NotNull] = None
    email: Annotated[Email | None, NotNull] = None


class ChangePasswordRequest(NewPasswordFields):
    current_password: GivenPassword


class UpdatePreferencesRequest(BaseModel):
    """Unknown keys are ignored; known ones are merged into the saved preferences."""

    theme: Annotated[Theme | None, NotNull] = None
    sort: Annotated[NoteSort | None, NotNull] = None
    group_by_date: Annotated[StrictBool | None, NotNull] = None
    show_snippets: Annotated[StrictBool | None, NotNull] = None
