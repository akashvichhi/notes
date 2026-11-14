import json
from pathlib import Path

import pytest

from app.content.snippet import build_snippet

# Golden cases pin where snippets start and end and when they get an ellipsis.
GOLDEN_CASES = json.loads(
    (Path(__file__).parents[2] / "golden" / "snippets.json").read_text(encoding="utf-8")
)


@pytest.mark.parametrize(
    ("text", "terms", "snippet"),
    [(case["text"], case["terms"], case["snippet"]) for case in GOLDEN_CASES],
    ids=[f"case{index}" for index in range(len(GOLDEN_CASES))],
)
def test_snippet_matches_the_golden_cases(text: str, terms: list[str], snippet: str) -> None:
    assert build_snippet(text, terms) == snippet


def test_snippet_centres_on_the_first_term_found_ignoring_case() -> None:
    text = "filler " * 30 + "The Needle" + " filler" * 30

    snippet = build_snippet(text, ["absent", "needle"])

    assert snippet.startswith("…")
    assert snippet.endswith("…")
    assert "The Needle" in snippet


def test_without_a_match_the_snippet_is_the_start_of_the_text() -> None:
    assert build_snippet("short text", ["absent"]) == "short text"


def test_snippet_keeps_text_that_looks_like_html() -> None:
    # The web app escapes snippets, so text a user typed is shown as typed.
    assert build_snippet("compare <b> and </b>", ["compare"]) == "compare <b> and </b>"
