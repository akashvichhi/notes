from typing import Self

from pydantic import BaseModel, model_validator

from app.constants import messages
from app.schemas.common.field_types import Email, GivenPassword, NewPassword, UserName, field_error


class RegisterRequest(BaseModel):
    name: UserName
    email: Email
    password: NewPassword
    password_confirmation: str

    @model_validator(mode="after")
    def passwords_match(self) -> Self:
        if self.password != self.password_confirmation:
            raise field_error("password", messages.PASSWORD_CONFIRMATION_MISMATCH)
        return self


class LoginRequest(BaseModel):
    email: Email
    password: GivenPassword
