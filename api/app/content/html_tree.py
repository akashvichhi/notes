"""DOM-style access to an lxml HTML tree. lxml keeps text in an element's .text and .tail;
a DOM keeps it in text nodes. The HTML steps of the Markdown converter follow DOM rules, so
these helpers give that view: a child node is either text or an element."""

import html
from typing import Final, TypeGuard

from lxml import etree

type HtmlElement = etree._Element
type HtmlNode = str | etree._Element

_ENCODING: Final = "utf-8"


def parse_html(markup: str) -> HtmlElement | None:
    """The root element of the parsed document, or None when there is nothing to parse."""
    if markup.strip() == "":
        return None
    parser = etree.HTMLParser(encoding=_ENCODING, no_network=True)
    return etree.fromstring(markup.encode(_ENCODING), parser)


def body_of(root: HtmlElement | None) -> HtmlElement | None:
    return root.find("body") if root is not None else None


def is_element(node: HtmlNode) -> TypeGuard[HtmlElement]:
    """An element, as opposed to text, a comment or a processing instruction."""
    return not isinstance(node, str) and isinstance(node.tag, str)


def child_nodes(element: HtmlElement) -> list[HtmlNode]:
    """The element's children in document order, its text runs included."""
    nodes: list[HtmlNode] = []
    if element.text:
        nodes.append(element.text)
    for child in element:
        nodes.append(child)
        if child.tail:
            nodes.append(child.tail)
    return nodes


def has_child_nodes(element: HtmlElement) -> bool:
    return bool(element.text) or len(element) > 0


def descendants(element: HtmlElement, tag: str) -> list[HtmlElement]:
    return list(element.iterdescendants(tag))


def remove(element: HtmlElement) -> None:
    """Removes the element but not the text that follows it."""
    parent = element.getparent()
    if parent is None:
        return
    _append_text_before(element, element.tail)
    element.tail = None
    parent.remove(element)


def move_children(source: HtmlElement, target: HtmlElement, *, keep: HtmlElement | None = None) -> None:
    """Moves every child node of source, text included, to the end of target; `keep` stays."""
    _append_text(target, source.text)
    source.text = None
    for child in list(source):
        if child is keep:
            _append_text(target, child.tail)
            child.tail = None
            continue
        target.append(child)


def serialize_children(element: HtmlElement) -> str:
    out = html.escape(element.text or "", quote=False)
    for child in element:
        out += etree.tostring(child, method="html", encoding="unicode", with_tail=True)
    return out


def _append_text(target: HtmlElement, text: str | None) -> None:
    """Adds text after the target's last child node."""
    if not text:
        return
    last = target[-1] if len(target) else None
    if last is None:
        target.text = (target.text or "") + text
    else:
        last.tail = (last.tail or "") + text


def _append_text_before(element: HtmlElement, text: str | None) -> None:
    """Adds text to the node just before the element (its previous sibling or its parent)."""
    if not text:
        return
    previous = element.getprevious()
    if previous is not None:
        previous.tail = (previous.tail or "") + text
        return
    parent = element.getparent()
    if parent is not None:
        parent.text = (parent.text or "") + text
