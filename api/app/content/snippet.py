"""Search result snippets: plain text around the first matching term. They carry no
markup and keep text that looks like HTML as typed: the web app escapes them and
highlights the terms itself."""

from collections.abc import Sequence

from app.constants.search_constants import SNIPPET_ELLIPSIS, SNIPPET_RADIUS
from app.content.text_rules import collapse_whitespace, fold_case


def build_snippet(text: str, terms: Sequence[str]) -> str:
    text = collapse_whitespace(text)
    if text == "":
        return ""
    window = SNIPPET_RADIUS * 2
    match_at = _first_match(text, terms)
    if match_at is None:
        return text[:window] + (SNIPPET_ELLIPSIS if len(text) > window else "")
    start = max(0, match_at - SNIPPET_RADIUS)
    before = SNIPPET_ELLIPSIS if start > 0 else ""
    after = SNIPPET_ELLIPSIS if start + window < len(text) else ""
    return before + text[start : start + window] + after


def _first_match(text: str, terms: Sequence[str]) -> int | None:
    """Where the first term that occurs starts, ignoring case (terms in the given order)."""
    folded = fold_case(text)
    for term in terms:
        position = folded.find(fold_case(term))
        if position != -1:
            return position
    return None
