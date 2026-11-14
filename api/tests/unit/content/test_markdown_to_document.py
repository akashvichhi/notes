import json
from pathlib import Path

import pytest

from app.content.content_error import ContentError
from app.content.markdown_to_document import markdown_to_document

# Golden cases pin how Markdown becomes an editor document: CommonMark and GFM syntax,
# the inline HTML the editor keeps, unsafe links and images, and image placeholders.
GOLDEN_CASES = json.loads(
    (Path(__file__).parents[2] / "golden" / "markdown_to_prosemirror.json").read_text(encoding="utf-8")
)


@pytest.mark.parametrize("case", GOLDEN_CASES, ids=[case["name"] for case in GOLDEN_CASES])
def test_markdown_becomes_the_golden_document(case: dict[str, object]) -> None:
    markdown = case["markdown"]
    current_doc = case["current_doc"]
    assert isinstance(markdown, str)
    assert current_doc is None or isinstance(current_doc, dict)

    if "error" in case:
        with pytest.raises(ContentError) as raised:
            markdown_to_document(markdown, current_doc)
        assert str(raised.value) == case["error"]
        return

    assert markdown_to_document(markdown, current_doc) == case["doc"]


def test_the_document_keeps_the_key_order_the_editor_wrote() -> None:
    case = next(case for case in GOLDEN_CASES if case["name"] == "a raw html table with colspan")

    converted = markdown_to_document(case["markdown"], None)

    assert json.dumps(converted) == json.dumps(case["doc"])


def test_markdown_over_a_million_bytes_is_too_large() -> None:
    with pytest.raises(ContentError):
        markdown_to_document("x" * 1_000_001, None)
