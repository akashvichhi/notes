"""/api/v1/search: the search box that looks through every note, folder and tag."""

from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.api.dependencies import CurrentUser, SearchServiceDependency, get_current_user, limit_searches
from app.schemas.common.data_response import DataResponse
from app.schemas.requests.search_request import SearchRequest
from app.schemas.resources.search_resource import SearchResultsResource

search_router = APIRouter(prefix="/search", tags=["search"], dependencies=[Depends(get_current_user)])


@search_router.get(
    "", response_model=DataResponse[SearchResultsResource], dependencies=[Depends(limit_searches)]
)
def search(
    query: Annotated[SearchRequest, Query()], user: CurrentUser, service: SearchServiceDependency
) -> DataResponse[SearchResultsResource]:
    return DataResponse(data=service.search(user, query))
