from pydantic import BaseModel, Field

from app.constants.pagination_constants import DEFAULT_PAGE, DEFAULT_PER_PAGE, MAX_PER_PAGE


class PaginationRequest(BaseModel):
    page: int = Field(default=DEFAULT_PAGE, ge=1)
    per_page: int = Field(default=DEFAULT_PER_PAGE, ge=1, le=MAX_PER_PAGE)

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.per_page
