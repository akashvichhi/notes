from app.schemas.common.paginated_response import PaginatedResponse
from app.schemas.common.pagination_request import PaginationRequest


def test_meta_counts_pages_from_the_total() -> None:
    response = PaginatedResponse[int].create(
        [1, 2], total_count=45, pagination=PaginationRequest(page=3, per_page=20)
    )

    assert response.meta.model_dump() == {
        "total_count": 45,
        "current_page": 3,
        "per_page": 20,
        "total_pages": 3,
    }


def test_no_results_means_zero_pages() -> None:
    response = PaginatedResponse[int].create([], total_count=0, pagination=PaginationRequest())

    assert response.data == []
    assert response.meta.total_pages == 0


def test_offset_skips_the_earlier_pages() -> None:
    assert PaginationRequest(page=3, per_page=20).offset == 40
