"""HTML to a raw editor document. Each element becomes the first node type whose rule
matches it; otherwise the first mark type whose rule matches, which applies to the text
inside it; otherwise its children are read in its place. The result is not yet valid for
the editor's schema: DocumentNormalizer makes it so."""

import re
from collections.abc import Callable
from dataclasses import dataclass
from typing import Final

from app.content.document_values import as_int
from app.content.html_minify import minify_html
from app.content.html_tree import HtmlElement, body_of, child_nodes, has_child_nodes, is_element, parse_html
from app.schemas.common.json_types import JsonObject, JsonValue

# A style declaration: `name: value`. Names and the separator are ASCII.
_STYLE_DECLARATION: Final = re.compile(r"([\w-]+)\s*:\s*([^;]+)\s*;?", re.ASCII)
_HEADING_TAGS: Final = {f"h{level}": level for level in range(1, 7)}
_LANGUAGE_PREFIX: Final = re.compile("^language-")
_COLOR_QUOTES: Final = re.compile("['\"]+")
_BOLD_WEIGHT: Final = re.compile(r"(bold(er)?|[5-9]\d{2,})$")
_NORMAL: Final = "normal"
# Attribute values read as "not set".
_UNSET_VALUES: Final = frozenset({"", "0"})
# Characters a browser ignores in a URL, so they cannot hide a scheme.
_URL_IGNORED: Final = re.compile(
    "["
    + "".join(chr(code) for code in range(0x21))
    + chr(0xA0)
    + chr(0x1680)
    + chr(0x180E)
    + chr(0x2000)
    + "-"
    + chr(0x2029)
    + chr(0x205F)
    + chr(0x3000)
    + "]"
)
_LINK_PROTOCOLS: Final = ("http", "https", "ftp", "ftps", "mailto", "tel", "callto", "sms", "cid", "xmpp")
_ALLOWED_URL: Final = re.compile(
    "(?:(?:" + "|".join(_LINK_PROTOCOLS) + r"):|[^a-z]|[a-z0-9+.\-]+(?:[^a-z+.\-:]|$))", re.IGNORECASE
)
_TEXT_LEADING: Final = "\n"


def html_to_document(markup: str) -> JsonObject:
    body = body_of(parse_html(minify_html(markup)))
    return {"type": "doc", "content": _Reader().children(body) if body is not None else []}


@dataclass(frozen=True)
class _Rule:
    """Which elements a node or mark type claims, and the attributes it reads from them."""

    name: str
    matches: Callable[[HtmlElement], bool]
    attributes: Callable[[HtmlElement], JsonObject]


class _Reader:
    def __init__(self) -> None:
        # The marks of the elements around the current one, outermost first.
        self._marks: list[JsonObject] = []

    def children(self, element: HtmlElement) -> list[JsonValue]:
        nodes: list[JsonValue] = []
        for child in child_nodes(element):
            if isinstance(child, str):
                text = child.lstrip(_TEXT_LEADING)
                if text:
                    nodes.append(self._with_marks({"type": "text", "text": text}))
                continue
            if not is_element(child):
                continue
            node_rule = _first_match(_NODE_RULES, child)
            if node_rule is not None:
                nodes.append(self._node(node_rule, child))
                continue
            mark_rule = _first_match(_MARK_RULES, child)
            if mark_rule is not None:
                self._marks.append(_item(mark_rule, child))
                nodes.extend(self.children(child))
                self._marks.pop()
                continue
            nodes.extend(self.children(child))
        return nodes

    def _node(self, rule: _Rule, element: HtmlElement) -> JsonObject:
        item = _item(rule, element)
        if has_child_nodes(element):
            item["content"] = self.children(element)
        return self._with_marks(item)

    def _with_marks(self, item: JsonObject) -> JsonObject:
        if self._marks:
            item["marks"] = list(self._marks)
        return item


def _first_match(rules: tuple[_Rule, ...], element: HtmlElement) -> _Rule | None:
    return next((rule for rule in rules if rule.matches(element)), None)


def _item(rule: _Rule, element: HtmlElement) -> JsonObject:
    item: JsonObject = {"type": rule.name}
    attrs = rule.attributes(element)
    if attrs:
        item["attrs"] = attrs
    return item


# ── Element tests ────────────────────────────────────────────────────────────


def _styles(element: HtmlElement) -> dict[str, str]:
    """The element's inline style declarations; a repeated name keeps its last value."""
    return {match.group(1): match.group(2) for match in _STYLE_DECLARATION.finditer(element.get("style", ""))}


def _tag(*names: str) -> Callable[[HtmlElement], bool]:
    return lambda element: element.tag in names


def _tag_with(name: str, attribute: str, value: str | None = None) -> Callable[[HtmlElement], bool]:
    def matches(element: HtmlElement) -> bool:
        if element.tag != name or attribute not in element.attrib:
            return False
        return value is None or element.get(attribute) == value

    return matches


def _style(name: str, value: str) -> Callable[[HtmlElement], bool]:
    return lambda element: _styles(element).get(name) == value


def _any(*tests: Callable[[HtmlElement], bool]) -> Callable[[HtmlElement], bool]:
    return lambda element: any(test(element) for test in tests)


def _without_normal_style(name: str) -> Callable[[HtmlElement], bool]:
    """<b> and <i> count unless any of their declarations is `normal`."""
    return lambda element: element.tag == name and _NORMAL not in _styles(element).values()


def _bold_weight(element: HtmlElement) -> bool:
    weight = _styles(element).get("font-weight")
    return weight is not None and _BOLD_WEIGHT.match(weight) is not None


def _allowed_link(element: HtmlElement) -> bool:
    if element.tag != "a" or "href" not in element.attrib:
        return False
    href = element.get("href", "")
    return href != "" and _ALLOWED_URL.match(_URL_IGNORED.sub("", href)) is not None


# ── Attribute readers ────────────────────────────────────────────────────────


def _no_attributes(_: HtmlElement) -> JsonObject:
    return {}


def _present(element: HtmlElement, *names: str) -> JsonObject:
    """The named attributes that are set and not "" or "0"."""
    attrs: JsonObject = {}
    for name in names:
        value = element.get(name, "")
        if value not in _UNSET_VALUES:
            attrs[name] = value
    return attrs


def _text_align(element: HtmlElement) -> JsonObject:
    alignment = _styles(element).get("text-align")
    return {"textAlign": alignment} if alignment is not None else {}


def _heading_attributes(element: HtmlElement) -> JsonObject:
    return {"level": _HEADING_TAGS[str(element.tag)], **_text_align(element)}


def _start_attributes(element: HtmlElement) -> JsonObject:
    start = as_int(element.get("start", ""))
    return {"start": start} if start else {}


def _language_attributes(element: HtmlElement) -> JsonObject:
    nodes = child_nodes(element)
    first = nodes[0] if nodes else None
    if first is None or not is_element(first):
        return {}
    language = _LANGUAGE_PREFIX.sub("", first.get("class", ""))
    return {"language": language} if language not in _UNSET_VALUES else {}


def _cell_attributes(element: HtmlElement) -> JsonObject:
    attrs: JsonObject = {}
    for name in ("rowspan", "colspan"):
        span = as_int(element.get(name, ""))
        if span:
            attrs[name] = span
    widths = element.get("data-colwidth", "")
    if widths not in _UNSET_VALUES:
        attrs["colwidth"] = [as_int(width) for width in widths.split(",")]
    return attrs


def _color_attributes(element: HtmlElement) -> JsonObject:
    color = _styles(element).get("color")
    return {"color": _COLOR_QUOTES.sub("", color)} if color is not None else {}


# ── The rules, in the order they are tried ───────────────────────────────────

_NODE_RULES: Final = (
    _Rule("taskList", _tag_with("ul", "data-type", "taskList"), _no_attributes),
    _Rule("taskItem", _tag_with("li", "data-type", "taskItem"), lambda element: _present(element, "checked")),
    _Rule("paragraph", _tag("p"), _text_align),
    _Rule("table", _tag("table"), _no_attributes),
    _Rule("tableRow", _tag("tr"), _no_attributes),
    _Rule("tableHeader", _tag("th"), _cell_attributes),
    _Rule("tableCell", _tag("td"), _cell_attributes),
    _Rule(
        "image",
        _tag_with("img", "src"),
        lambda element: _present(element, "src", "alt", "title", "width", "height"),
    ),
    _Rule("details", _tag("details"), _no_attributes),
    _Rule("detailsSummary", _tag("summary"), _no_attributes),
    # Any typed div: the editor writes only detailsContent.
    _Rule("detailsContent", _tag_with("div", "data-type"), _no_attributes),
    _Rule("blockquote", _tag("blockquote"), _no_attributes),
    _Rule("bulletList", _tag("ul"), _no_attributes),
    _Rule("codeBlock", _tag("pre"), _language_attributes),
    _Rule("hardBreak", _tag("br"), _no_attributes),
    _Rule("heading", _tag(*_HEADING_TAGS), _heading_attributes),
    _Rule("horizontalRule", _tag("hr"), _no_attributes),
    _Rule("listItem", _tag("li"), _no_attributes),
    _Rule("orderedList", _tag("ol"), _start_attributes),
)

_ITALIC: Final = _any(_tag("em"), _without_normal_style("i"), _style("font-style", "italic"))
_STRIKE: Final = _any(_tag("s", "del", "strike"), _style("text-decoration", "line-through"))

_MARK_RULES: Final = (
    _Rule("underline", _any(_tag("u"), _style("text-decoration", "underline")), _no_attributes),
    _Rule("link", _allowed_link, lambda element: _present(element, "href", "target", "rel", "class")),
    _Rule("highlight", _tag("mark"), _no_attributes),
    _Rule("textStyle", _tag_with("span", "style"), _color_attributes),
    _Rule("subscript", _any(_tag("sub"), _style("vertical-align", "sub")), _no_attributes),
    _Rule("superscript", _any(_tag("sup"), _style("vertical-align", "super")), _no_attributes),
    _Rule("bold", _any(_tag("strong"), _without_normal_style("b"), _bold_weight), _no_attributes),
    _Rule("code", _tag("code"), _no_attributes),
    _Rule("italic", _ITALIC, _no_attributes),
    _Rule("strike", _STRIKE, _no_attributes),
)
