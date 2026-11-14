from pydantic import BaseModel

from app.schemas.common.field_types import SearchQuery


class SearchRequest(BaseModel):
    q: SearchQuery
