import json
from pathlib import Path

import pytest

from app.content.note_text import derive_note_text
from app.schemas.common.json_types import JsonObject

# Golden cases pin the plain text, excerpt, word count and title, edge cases included
# (Unicode spaces, NUL, wide characters, long titles), so derived text never drifts.
GOLDEN_CASES = json.loads(
    (Path(__file__).parents[2] / "golden" / "note_text.json").read_text(encoding="utf-8")
)


@pytest.mark.parametrize("case", GOLDEN_CASES, ids=[f"case{index}" for index in range(len(GOLDEN_CASES))])
def test_note_text_matches_the_golden_cases(case: dict[str, object]) -> None:
    body = case["body"]
    assert isinstance(body, dict)

    derived = derive_note_text(body)

    assert (derived.plain_text, derived.excerpt, derived.word_count, derived.title) == (
        case["plain_text"],
        case["excerpt"],
        case["word_count"],
        case["title"],
    )


def _doc(*blocks: JsonObject) -> JsonObject:
    return {"type": "doc", "content": list(blocks)}


def _block(node_type: str, text: str) -> JsonObject:
    return {"type": node_type, "content": [{"type": "text", "text": text}]}


def test_the_first_heading_is_the_title_even_after_a_paragraph() -> None:
    derived = derive_note_text(_doc(_block("paragraph", "Intro"), _block("heading", "Plan")))

    assert derived.title == "Plan"


def test_without_a_heading_the_first_block_with_text_is_the_title() -> None:
    derived = derive_note_text(_doc(_block("paragraph", "   "), _block("paragraph", "First words")))

    assert derived.title == "First words"


def test_text_nodes_are_joined_with_single_spaces() -> None:
    no_break_space = chr(0xA0)

    derived = derive_note_text(
        _doc(_block("paragraph", "one  two"), _block("paragraph", f"{no_break_space}three "))
    )

    assert (derived.plain_text, derived.word_count) == ("one two three", 3)


def test_the_excerpt_counts_wide_characters_twice() -> None:
    derived = derive_note_text(_doc(_block("paragraph", "日" * 100)))

    assert derived.excerpt == "日" * 70


def test_an_empty_document_has_no_text() -> None:
    derived = derive_note_text({"type": "doc", "content": []})

    assert (derived.plain_text, derived.excerpt, derived.word_count, derived.title) == ("", "", 0, "")
