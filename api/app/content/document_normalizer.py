"""Makes a parsed document valid for the editor's schema: inline runs inside block
containers get a paragraph, block images are lifted out of paragraphs, list items start
with a paragraph, cells are never empty, attributes get the editor's defaults, and
`note-image:N` placeholders become the original images again."""

from typing import Final

from app.constants import messages
from app.content.content_error import ContentError
from app.content.document_values import (
    as_int,
    as_text,
    attribute,
    attribute_or,
    attributes,
    children,
    has_type,
    is_numeric,
    node_type,
    objects,
)
from app.content.editor_schema import (
    ALIGNMENTS,
    HEADING_LEVEL_MAX,
    HEADING_LEVEL_MIN,
    INLINE_NODES,
    LINK_REL,
    LINK_TARGET,
    LIST_ITEMS,
    LISTS,
    MARKS,
)
from app.content.note_images import placeholder, placeholder_number
from app.content.text_rules import trim_ascii
from app.schemas.common.json_types import JsonObject, JsonValue

_IMAGE_SCHEMES: Final = ("http://", "https://", "data:image/")
_TABLE_CELLS: Final = frozenset({"tableCell", "tableHeader"})
_CHECKED_TEXTS: Final = frozenset({"true", "checked"})
_EMPTY_PARAGRAPH: Final[JsonObject] = {"type": "paragraph"}


class DocumentNormalizer:
    def __init__(self, embedded_images: list[str]) -> None:
        """embedded_images: the data URLs the placeholders refer to, in document order."""
        self._embedded_images = embedded_images

    def normalize(self, doc: JsonObject) -> JsonObject:
        return {"type": "doc", "content": self._blocks(children(doc))}

    def _blocks(self, nodes: list[JsonValue]) -> list[JsonValue]:
        """Any mix of nodes becomes a list of valid block nodes."""
        out: list[JsonValue] = []
        inline: list[JsonValue] = []
        for node in objects(nodes):
            if not has_type(node):
                continue
            if node_type(node) in INLINE_NODES:
                inline.append(node)
                continue
            if inline:
                out.extend(self._paragraphs({"type": "paragraph", "content": inline}))
                inline = []
            out.extend(self._block(node))
        if inline:
            out.extend(self._paragraphs({"type": "paragraph", "content": inline}))
        return out

    def _block(self, node: JsonObject) -> list[JsonValue]:
        """Zero or more block nodes."""
        match node_type(node):
            case "paragraph" | "heading":
                return self._paragraphs(node)
            case "blockquote":
                return [{"type": "blockquote", "content": self._blocks_or_empty(children(node))}]
            case "bulletList" | "orderedList" | "taskList":
                return self._list(node)
            case "codeBlock":
                return [self._code_block(node)]
            case "horizontalRule":
                return [{"type": "horizontalRule"}]
            case "image":
                return [self._image(node)]
            case "table":
                return self._table(node)
            case "details":
                return [self._details(node)]
            case "detailsSummary":
                return self._paragraphs({"type": "paragraph", "content": node.get("content")})
            case _:
                # Misplaced structure (a bare list item, row or cell): keep what is inside it.
                return self._blocks(children(node))

    def _blocks_or_empty(self, nodes: list[JsonValue]) -> list[JsonValue]:
        return self._blocks(nodes) or [dict(_EMPTY_PARAGRAPH)]

    def _paragraphs(self, node: JsonObject) -> list[JsonValue]:
        """A paragraph or heading. Block nodes inside it (usually an image, since Markdown
        puts `![](...)` in a paragraph) split it, so this may return several."""
        attrs: JsonObject = {}
        if node_type(node) == "heading":
            level = as_int(attribute_or(node, "level", 1))
            attrs["level"] = level if HEADING_LEVEL_MIN <= level <= HEADING_LEVEL_MAX else HEADING_LEVEL_MIN
        align = attribute(node, "textAlign")
        if isinstance(align, str) and align in ALIGNMENTS:
            attrs["textAlign"] = align

        def make(run: list[JsonValue]) -> JsonObject:
            paragraph: JsonObject = {"type": node_type(node)}
            if attrs:
                paragraph["attrs"] = dict(attrs)
            inline = self._inline(run)
            if inline:
                paragraph["content"] = inline
            return paragraph

        out: list[JsonValue] = []
        run: list[JsonValue] = []
        split = False
        for child in objects(children(node)):
            if not has_type(child):
                continue
            if node_type(child) in INLINE_NODES:
                run.append(child)
                continue
            split = True
            if self._inline(run):
                out.append(make(run))
            run = []
            out.extend(self._block(child))
        if not split or self._inline(run):
            out.append(make(run))
        return out

    def _inline(self, nodes: list[JsonValue], *, allow_breaks: bool = True) -> list[JsonValue]:
        """Text and hard breaks with clean marks; adjacent text with equal marks is merged."""
        out: list[JsonValue] = []
        last: JsonObject | None = None
        for node in objects(nodes):
            if node_type(node) == "hardBreak":
                last = {"type": "hardBreak"} if allow_breaks else {"type": "text", "text": " "}
                out.append(last)
                continue
            text = node.get("text")
            if node_type(node) != "text" or not isinstance(text, str) or text == "":
                continue
            item: JsonObject = {"type": "text", "text": text}
            marks = self._marks(children(node, "marks"))
            if marks:
                item["marks"] = marks
            if last is not None and _can_merge(last, item):
                last["text"] = as_text(last.get("text")) + text
            else:
                last = item
                out.append(item)
        return out

    def _marks(self, marks: list[JsonValue]) -> list[JsonValue]:
        by_type: dict[str, JsonObject] = {}
        for mark in objects(marks):
            mark_type = node_type(mark)
            if mark_type not in MARKS or mark_type in by_type:
                continue
            clean = _clean_mark(mark_type, attributes(mark))
            if clean is not None:
                by_type[mark_type] = clean
        # The editor's code mark excludes every other mark.
        if "code" in by_type:
            return [{"type": "code"}]
        return [by_type[mark_type] for mark_type in MARKS if mark_type in by_type]

    def _list(self, node: JsonObject) -> list[JsonValue]:
        list_type = node_type(node)
        item_type = LISTS[list_type]
        items: list[JsonValue] = []
        last_item: JsonObject | None = None
        for child in objects(children(node)):
            if not has_type(child):
                continue
            child_type = node_type(child)
            if child_type in LIST_ITEMS:
                last_item = self._list_item(item_type, child)
            elif child_type in LISTS and last_item is not None:
                # A list directly inside a list belongs to the item before it.
                content = last_item["content"]
                if isinstance(content, list):
                    content.extend(self._block(child))
                continue
            else:
                last_item = self._list_item(item_type, {"type": item_type, "content": [child]})
            items.append(last_item)
        if not items:
            return []
        result: JsonObject = {"type": list_type, "content": items}
        if list_type == "orderedList":
            start = as_int(attribute_or(node, "start", 1))
            result["attrs"] = {"start": start if start >= 0 else 1, "type": None}
        return [result]

    def _list_item(self, item_type: str, node: JsonObject) -> JsonObject:
        content = self._blocks(children(node))
        # listItem and taskItem are "paragraph block*".
        first = content[0] if content else None
        if not isinstance(first, dict) or node_type(first) != "paragraph":
            content.insert(0, dict(_EMPTY_PARAGRAPH))
        item: JsonObject = {"type": item_type}
        if item_type == "taskItem":
            item["attrs"] = {"checked": _is_checked(attribute(node, "checked"))}
        item["content"] = content
        return item

    def _code_block(self, node: JsonObject) -> JsonObject:
        text = _text_of(node)
        # Markdown ends every fenced block with a newline the editor never has.
        text = text.removesuffix("\n")
        language = attribute(node, "language")
        block: JsonObject = {
            "type": "codeBlock",
            "attrs": {"language": language if isinstance(language, str) and language != "" else None},
        }
        if text:
            block["content"] = [{"type": "text", "text": text}]
        return block

    def _image(self, node: JsonObject) -> JsonObject:
        attrs = attributes(node)
        source = trim_ascii(as_text(attrs.get("src")))
        number = placeholder_number(source)
        if number is not None:
            if not 1 <= number <= len(self._embedded_images):
                raise ContentError(messages.UNKNOWN_IMAGE_PLACEHOLDER.format(placeholder=placeholder(number)))
            source = self._embedded_images[number - 1]
        elif not source.lower().startswith(_IMAGE_SCHEMES):
            raise ContentError(messages.IMAGE_SOURCE_NOT_ALLOWED)
        return {
            "type": "image",
            "attrs": {
                "src": source,
                "alt": _optional_text(attrs.get("alt")),
                "title": _optional_text(attrs.get("title")),
                "width": _dimension(attrs.get("width")),
                "height": _dimension(attrs.get("height")),
            },
        }

    def _table(self, node: JsonObject) -> list[JsonValue]:
        rows: list[list[JsonObject]] = []
        for row in objects(children(node)):
            cells: list[JsonObject] = []
            row_cells = objects(children(row)) if node_type(row) == "tableRow" else [row]
            for cell in row_cells:
                if not has_type(cell):
                    continue
                # A stray block in a row becomes the content of a cell.
                is_cell = node_type(cell) in _TABLE_CELLS
                cells.append(self._cell(cell if is_cell else {"type": "tableCell", "content": [cell]}))
            if cells:
                rows.append(cells)
        if not rows:
            return []
        # ProseMirror tables must be rectangular.
        width = max(_span(cells) for cells in rows)
        content: list[JsonValue] = []
        for cells in rows:
            cell_type = node_type(cells[0])
            row_content: list[JsonValue] = list(cells)
            row_content.extend(self._cell({"type": cell_type}) for _ in range(width - _span(cells)))
            content.append({"type": "tableRow", "content": row_content})
        return [{"type": "table", "content": content}]

    def _cell(self, node: JsonObject) -> JsonObject:
        colwidth = attribute(node, "colwidth")
        widths: list[JsonValue] = [as_int(width) for width in children({"content": colwidth})]
        return {
            "type": node_type(node),
            "attrs": {
                "colspan": max(1, as_int(attribute_or(node, "colspan", 1))),
                "rowspan": max(1, as_int(attribute_or(node, "rowspan", 1))),
                "colwidth": widths if isinstance(colwidth, list | dict) else None,
            },
            "content": self._blocks_or_empty(children(node)),
        }

    def _details(self, node: JsonObject) -> JsonObject:
        summary: list[JsonValue] = []
        body: list[JsonValue] = []
        for child in objects(children(node)):
            child_type = node_type(child)
            if child_type == "detailsSummary" and not summary:
                summary = self._inline(children(child), allow_breaks=False)
            elif child_type == "detailsContent":
                body.extend(children(child))
            else:
                body.append(child)
        summary_node: JsonObject = {"type": "detailsSummary"}
        if summary:
            summary_node["content"] = summary
        return {
            "type": "details",
            "content": [summary_node, {"type": "detailsContent", "content": self._blocks_or_empty(body)}],
        }


def _clean_mark(mark_type: str, attrs: JsonObject) -> JsonObject | None:
    if mark_type == "link":
        href = trim_ascii(as_text(attrs.get("href")))
        if href == "":
            return None
        return {
            "type": "link",
            "attrs": {
                "href": href,
                "target": _or_default(attrs.get("target"), LINK_TARGET),
                "rel": _or_default(attrs.get("rel"), LINK_REL),
                "class": attrs.get("class"),
            },
        }
    if mark_type == "textStyle":
        color = attrs.get("color")
        # A textStyle without a colour carries nothing.
        if not isinstance(color, str) or color == "":
            return None
        return {"type": "textStyle", "attrs": {"color": color}}
    return {"type": mark_type}


def _can_merge(previous: JsonObject, text: JsonObject) -> bool:
    return node_type(previous) == "text" and (previous.get("marks") or []) == (text.get("marks") or [])


def _is_checked(value: JsonValue) -> bool:
    if value is True:
        return True
    if isinstance(value, str):
        return value in _CHECKED_TEXTS
    return type(value) is int and value == 1


def _text_of(node: JsonObject) -> str:
    match node_type(node):
        case "text":
            return as_text(node.get("text"))
        case "hardBreak":
            return "\n"
        case _:
            return "".join(_text_of(child) for child in objects(children(node)))


def _optional_text(value: JsonValue) -> str | None:
    return as_text(value) if value is not None and value != "" else None


def _dimension(value: JsonValue) -> int | None:
    return as_int(value) if is_numeric(value) else None


def _or_default(value: JsonValue, default: str) -> JsonValue:
    return value if value is not None else default


def _span(cells: list[JsonObject]) -> int:
    return sum(as_int(attribute(cell, "colspan")) for cell in cells)
