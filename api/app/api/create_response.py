from fastapi import Response, status

from app.schemas.common.data_response import DataResponse
from app.services.create_result import CreateResult


def create_response[ResourceT](
    result: CreateResult[ResourceT], response: Response
) -> DataResponse[ResourceT]:
    """201 for a new record, 200 when a retried create found the one it made before."""
    if not result.created:
        response.status_code = status.HTTP_200_OK
    return DataResponse(data=result.resource)
