from collections.abc import Sequence
from math import ceil
from typing import Self

from pydantic import BaseModel

from app.schemas.common.pagination_request import PaginationRequest


class PaginationMeta(BaseModel):
    total_count: int
    current_page: int
    per_page: int
    total_pages: int


class PaginatedResponse[T](BaseModel):
    data: list[T]
    meta: PaginationMeta

    @classmethod
    def create(cls, items: Sequence[T], total_count: int, pagination: PaginationRequest) -> Self:
        return cls(
            data=list(items),
            meta=PaginationMeta(
                total_count=total_count,
                current_page=pagination.page,
                per_page=pagination.per_page,
                total_pages=ceil(total_count / pagination.per_page),
            ),
        )
