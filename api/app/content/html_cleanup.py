"""Rewrites the HTML rendered from Markdown into the shapes the HTML-to-document step
expects: unusable elements removed, task lists marked, alignment as a style, and details
split into a summary and a content block."""

from typing import Final

from lxml import etree

from app.content.editor_schema import ALIGNMENTS
from app.content.html_tree import (
    HtmlElement,
    HtmlNode,
    body_of,
    child_nodes,
    descendants,
    is_element,
    move_children,
    parse_html,
    remove,
    serialize_children,
)
from app.content.text_rules import ltrim_ascii, trim_ascii

# Removed with their content: nothing in them can become note content.
_STRIPPED_TAGS: Final = (
    "script",
    "style",
    "iframe",
    "object",
    "embed",
    "noscript",
    "template",
    "form",
    "button",
    "textarea",
    "select",
    "link",
    "meta",
    "title",
    "head",
    "svg",
    "math",
)
_ALIGNABLE_TAGS: Final = frozenset({"p", "h1", "h2", "h3", "h4", "h5", "h6"})
_DOCUMENT_START: Final = '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>'
_DOCUMENT_END: Final = "</body></html>"


def prepare_html(markup: str) -> str:
    body = body_of(parse_html(_DOCUMENT_START + markup + _DOCUMENT_END))
    if body is None:
        return ""
    for tag in _STRIPPED_TAGS:
        for element in descendants(body, tag):
            remove(element)
    _mark_task_lists(body)
    _align(body)
    _split_details(body)
    # Any checkbox not consumed by a task list is not content.
    for element in descendants(body, "input"):
        remove(element)
    return trim_ascii(serialize_children(body))


def _mark_task_lists(body: HtmlElement) -> None:
    """`- [ ] x` renders as <li><input type="checkbox"> x</li>; the editor's task list
    is a ul and li marked with data-type."""
    for list_element in descendants(body, "ul"):
        items = [child for child in list_element if child.tag == "li"]
        boxes = [(item, _leading_checkbox(item)) for item in items]
        # The editor cannot mix task items and bullet items in one list.
        if all(box is None for _, box in boxes):
            continue
        list_element.set("data-type", "taskList")
        for item, box in boxes:
            item.set("data-type", "taskItem")
            # Only a checked item has the attribute: its value is read as the checked state.
            item.attrib.pop("checked", None)
            if box is None:
                continue
            if "checked" in box.attrib:
                item.set("checked", "checked")
            # Drop the space left after the checkbox.
            if box.tail:
                box.tail = ltrim_ascii(box.tail)
            remove(box)


def _leading_checkbox(item: HtmlElement) -> HtmlElement | None:
    node = _first_content_node(child_nodes(item))
    # A loose list item wraps its text, checkbox included, in a <p>.
    if node is not None and is_element(node) and node.tag == "p":
        nodes = child_nodes(node)
        node = nodes[0] if nodes else None
    if node is None or not is_element(node) or node.tag != "input":
        return None
    return node if node.get("type", "").lower() == "checkbox" else None


def _first_content_node(nodes: list[HtmlNode]) -> HtmlNode | None:
    """The first node that is not blank text."""
    for node in nodes:
        if not isinstance(node, str) or trim_ascii(node) != "":
            return node
    return None


def _align(body: HtmlElement) -> None:
    """`<p align="center">` becomes the inline style the editor's text alignment reads."""
    aligned = [
        element for element in body.iterdescendants() if is_element(element) and "align" in element.attrib
    ]
    for element in aligned:
        alignment = trim_ascii(str(element.attrib.pop("align"))).lower()
        if element.tag in _ALIGNABLE_TAGS and alignment in ALIGNMENTS:
            element.set("style", f"text-align: {alignment}")


def _split_details(body: HtmlElement) -> None:
    """<details><summary>...</summary>...</details> becomes the summary followed by a
    div[data-type=detailsContent] holding everything else."""
    # Innermost first, so nested details are already in shape when their parent moves them.
    for details in reversed(descendants(body, "details")):
        summary = next((child for child in details if child.tag == "summary"), None)
        content = etree.Element("div", {"data-type": "detailsContent"})
        move_children(details, content, keep=summary)
        details.append(summary if summary is not None else etree.Element("summary"))
        details.append(content)
