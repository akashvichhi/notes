from typing import Annotated

from pydantic import BaseModel, StringConstraints

from app.constants.search_constants import SEARCH_QUERY_MAX_LENGTH, SEARCH_TERM_MIN_LENGTH


class SearchRequest(BaseModel):
    # Shorter than one term, a query could never match a note.
    q: Annotated[
        str,
        StringConstraints(
            strip_whitespace=True, min_length=SEARCH_TERM_MIN_LENGTH, max_length=SEARCH_QUERY_MAX_LENGTH
        ),
    ]
