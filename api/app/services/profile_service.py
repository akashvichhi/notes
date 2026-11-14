"""The signed-in user's own account: name, email, password and display preferences."""

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.constants import messages
from app.core.exceptions import ConflictError, DomainValidationError, UnauthenticatedError
from app.core.security import PasswordHasher
from app.models.user_model import User
from app.repositories.access_token_repository import AccessTokenRepository
from app.repositories.user_repository import UserRepository
from app.repositories.user_session_repository import UserSessionRepository
from app.schemas.requests.profile_request import (
    ChangePasswordRequest,
    UpdatePreferencesRequest,
    UpdateProfileRequest,
)
from app.services.user_session_service import UserSessionService


class ProfileService:
    def __init__(
        self,
        db: Session,
        users: UserRepository,
        sessions: UserSessionRepository,
        access_tokens: AccessTokenRepository,
        session_tokens: UserSessionService,
        hasher: PasswordHasher,
    ) -> None:
        self._db = db
        self._users = users
        self._sessions = sessions
        self._access_tokens = access_tokens
        self._session_tokens = session_tokens
        self._hasher = hasher

    def update_profile(self, user: User, request: UpdateProfileRequest) -> User:
        changes = request.model_dump(exclude_unset=True)
        email = changes.get("email")
        if email is not None:
            self._ensure_email_is_free(email, user)
        for field, value in changes.items():
            setattr(user, field, value)
        try:
            self._db.commit()
        except IntegrityError:
            self._db.rollback()
            raise ConflictError.for_field("email", messages.EMAIL_TAKEN) from None
        return user

    def change_password(self, user: User, session_id: int, request: ChangePasswordRequest) -> str:
        """Returns this browser's new session id. Every other session and every access
        token ends, so a leaked password or token stops working at once."""
        if not self._hasher.verify(user.password_hash, request.current_password):
            raise DomainValidationError.for_field("current_password", messages.CURRENT_PASSWORD_INCORRECT)
        current_session = self._sessions.get(session_id)
        if current_session is None:
            raise UnauthenticatedError
        user.password_hash = self._hasher.hash(request.password)
        self._sessions.delete_others_of_user(user.id, keep_session_id=session_id)
        self._access_tokens.delete_all_of_user(user.id)
        token = self._session_tokens.rotate(current_session)
        self._db.commit()
        return token

    def update_preferences(self, user: User, request: UpdatePreferencesRequest) -> User:
        # Merged, so a client that doesn't know a key never blanks it out.
        user.preferences = {**user.preferences, **request.model_dump(mode="json", exclude_unset=True)}
        self._db.commit()
        return user

    def _ensure_email_is_free(self, email: str, user: User) -> None:
        owner = self._users.find_by_email(email)
        if owner is not None and owner.id != user.id:
            raise ConflictError.for_field("email", messages.EMAIL_TAKEN)
