"""Splitting a search query into the terms every result must contain."""

from app.constants.search_constants import SEARCH_TERM_MIN_LENGTH


def parse_search_terms(query: str) -> list[str]:
    return [term for term in query.split() if len(term) >= SEARCH_TERM_MIN_LENGTH]
