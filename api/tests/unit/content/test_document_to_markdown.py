import json
from pathlib import Path

import pytest

from app.content.content_error import ContentError
from app.content.document_to_markdown import document_to_markdown
from app.content.markdown_to_document import markdown_to_document

# Golden cases pin the Markdown an assistant reads for each editor document, and the
# document that Markdown becomes again when it is written back unchanged.
GOLDEN_CASES = json.loads(
    (Path(__file__).parents[2] / "golden" / "prosemirror_to_markdown.json").read_text(encoding="utf-8")
)


@pytest.mark.parametrize("case", GOLDEN_CASES, ids=[case["name"] for case in GOLDEN_CASES])
def test_a_document_becomes_the_golden_markdown(case: dict[str, object]) -> None:
    doc = case["doc"]
    assert isinstance(doc, dict)

    assert document_to_markdown(doc) == case["markdown"]


@pytest.mark.parametrize("case", GOLDEN_CASES, ids=[case["name"] for case in GOLDEN_CASES])
def test_unchanged_markdown_reads_back_as_the_golden_document(case: dict[str, object]) -> None:
    doc = case["doc"]
    markdown = case["markdown"]
    assert isinstance(doc, dict)
    assert isinstance(markdown, str)

    if "error_again" in case:
        with pytest.raises(ContentError) as raised:
            markdown_to_document(markdown, doc)
        assert str(raised.value) == case["error_again"]
        return

    assert markdown_to_document(markdown, doc) == case["doc_again"]
