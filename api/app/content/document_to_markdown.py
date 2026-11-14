"""The editor's document to Markdown. Formatting Markdown cannot express is written as
inline HTML that markdown_to_document reads back. Embedded (data-URL) images become
`note-image:N` placeholders.

Known limits of the Markdown form: table cells hold inline content only (other blocks in
a cell are flattened to text), and colspan, rowspan and column widths are not kept."""

import re
from collections.abc import Callable, Sequence
from itertools import count
from typing import Final

from app.content.document_values import (
    as_int,
    as_text,
    attribute,
    attribute_or,
    attributes,
    children,
    is_blank,
    mapping_key,
    node_type,
    objects,
)
from app.content.editor_schema import ALIGNMENTS, HEADING_LEVEL_MAX, HEADING_LEVEL_MIN, LISTS, MARKS
from app.content.note_images import is_embedded, placeholder
from app.content.text_rules import WHITESPACE_CHARACTERS, WHITESPACE_RUNS, rtrim_ascii, trim_ascii
from app.schemas.common.json_types import JsonObject, JsonValue

type _Delimiters = tuple[str, str]

_BLOCK_SEPARATOR: Final = "\n\n"
# Markdown has no empty paragraph: an empty one is spacing the user typed.
_EMPTY_PARAGRAPH: Final = "<p></p>"
_MARKDOWN_HARD_BREAK: Final = "\\\n"
_HTML_BREAK: Final = "<br>"
_HORIZONTAL_RULE: Final = "---"
_QUOTE_PREFIX: Final = "> "
_QUOTE_BLANK_LINE: Final = ">"
# Two adjacent lists of one kind would merge in Markdown, so every other one uses these.
_BULLET_MARKERS: Final = ("-", "*")
_ORDERED_DELIMITERS: Final = (".", ")")
# Continuation lines of a bullet or task item align with the text after "- ".
_BULLET_INDENT: Final = 2
_CODE_FENCE_MIN: Final = 3
_TABLE_EMPTY_CELL: Final = " "
_TABLE_SEPARATOR_CELL: Final = " --- |"
_DELIMITED_MARKS: Final = {"bold": "**", "italic": "*", "strike": "~~"}
_HTML_MARK_TAGS: Final = {
    "bold": "strong",
    "italic": "em",
    "strike": "s",
    "underline": "u",
    "highlight": "mark",
    "subscript": "sub",
    "superscript": "sup",
}
_CODE_MARK: Final = "code"
_HTML_ESCAPES: Final = str.maketrans({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;"})

_SPACE: Final = f"[{WHITESPACE_CHARACTERS}]"
_BACKTICK_RUNS: Final = re.compile("`+")
_EDGE_SPACES: Final = re.compile(f"({_SPACE}*)(.*?)({_SPACE}*)", re.DOTALL)
_MARKDOWN_SYNTAX: Final = re.compile(r"([\\`*\[\]~<])")
# An underscore between letters or digits can never be emphasis: snake_case stays readable.
_EMPHASIS_UNDERSCORE: Final = re.compile(r"(?<![^\W_])_|_(?![^\W_])")
# "&amp;" typed by the user must stay five characters, not become "&".
_ENTITY_START: Final = re.compile(r"&(?=#?\w+;)")
_LINE_START_SYNTAX: Final = (
    re.compile(f"^({_SPACE}*)([#>+=-])"),
    re.compile(f"^({_SPACE}*\\d+)([.)])"),
)
_URL_NEEDS_BRACKETS: Final = re.compile(f"[{WHITESPACE_CHARACTERS}()<>]")
_SAFE_COLOR: Final = re.compile(f"^[#\\w(),.%{WHITESPACE_CHARACTERS}-]+$")
_SAFE_LANGUAGE: Final = re.compile(r"^[\w+#.-]+$")


def document_to_markdown(doc: JsonObject | None) -> str:
    content = list(children(doc))
    # Trailing empty paragraphs are only the editor's room for the caret.
    while content and _is_empty_paragraph(content[-1]):
        content.pop()
    return rtrim_ascii(_MarkdownWriter().blocks(content))


def _is_empty_paragraph(node: JsonValue) -> bool:
    return isinstance(node, dict) and node.get("type") == "paragraph" and is_blank(node.get("content"))


class _MarkdownWriter:
    def __init__(self) -> None:
        # Embedded images seen so far: the next one's placeholder number.
        self._images = 0
        self._block_writers: dict[str, Callable[[JsonObject, bool], str]] = {
            "paragraph": lambda node, _: self._paragraph(node),
            "heading": lambda node, _: self._heading(node),
            "blockquote": lambda node, _: self._blockquote(node),
            "bulletList": self._bullet_list,
            "taskList": self._task_list,
            "orderedList": self._ordered_list,
            "codeBlock": lambda node, _: _code_block(node),
            "horizontalRule": lambda _node, _: _HORIZONTAL_RULE,
            "image": lambda node, _: self._image(attributes(node)),
            "table": lambda node, _: self._table(node),
            "details": lambda node, _: self._details(node),
        }

    # ── Blocks ──────────────────────────────────────────────────────────────

    def blocks(self, nodes: Sequence[JsonValue]) -> str:
        rendered: list[str] = []
        previous: str | None = None
        for node in nodes:
            if not isinstance(node, dict) or node.get("type") is None:
                continue
            kind = node_type(node)
            alternate = previous == kind and kind in LISTS
            text = self._block(node, alternate=alternate)
            if text is not None:
                rendered.append(text)
                previous = None if alternate else kind
        return _BLOCK_SEPARATOR.join(rendered)

    def _block(self, node: JsonObject, *, alternate: bool = False) -> str | None:
        writer = self._block_writers.get(node_type(node))
        if writer is not None:
            return writer(node, alternate)
        # An unknown node keeps its content.
        content = children(node)
        return self.blocks(content) if content else None

    def _blockquote(self, node: JsonObject) -> str:
        body = self.blocks(children(node))
        return _prefix_lines(body or _EMPTY_PARAGRAPH, _QUOTE_PREFIX, _QUOTE_PREFIX, _QUOTE_BLANK_LINE)

    def _paragraph(self, node: JsonObject) -> str:
        alignment = _alignment(node)
        if alignment is not None:
            return f'<p align="{alignment}">{self._inline_html(children(node))}</p>'
        return self._inline(children(node)) or _EMPTY_PARAGRAPH

    def _heading(self, node: JsonObject) -> str:
        level = max(HEADING_LEVEL_MIN, min(HEADING_LEVEL_MAX, as_int(attribute_or(node, "level", 1))))
        alignment = _alignment(node)
        if alignment is not None:
            return f'<h{level} align="{alignment}">{self._inline_html(children(node))}</h{level}>'
        return rtrim_ascii("#" * level + " " + self._inline(children(node)))

    def _bullet_list(self, node: JsonObject, alternate: bool) -> str:
        bullet = _BULLET_MARKERS[alternate]
        return self._list(node, lambda _item: (f"{bullet} ", _BULLET_INDENT))

    def _task_list(self, node: JsonObject, alternate: bool) -> str:
        bullet = _BULLET_MARKERS[alternate]

        def marker(item: JsonObject) -> tuple[str, int]:
            box = " " if is_blank(attribute(item, "checked")) else "x"
            return f"{bullet} [{box}] ", _BULLET_INDENT

        return self._list(node, marker)

    def _ordered_list(self, node: JsonObject, alternate: bool) -> str:
        delimiter = _ORDERED_DELIMITERS[alternate]
        numbers = count(as_int(attribute_or(node, "start", 1)))

        def marker(_item: JsonObject) -> tuple[str, int]:
            text = f"{next(numbers)}{delimiter} "
            return text, len(text)

        return self._list(node, marker)

    def _list(self, node: JsonObject, marker: Callable[[JsonObject], tuple[str, int]]) -> str:
        """`marker` gives each item's marker and the indent of its continuation lines."""
        items = objects(children(node))
        tight = _is_tight(items)
        rendered: list[str] = []
        for item in items:
            text, indent = marker(item)
            content = objects(children(item))
            # An empty first paragraph in a list item is just an empty item.
            body = self._item_body(content, tight=tight).removeprefix(_EMPTY_PARAGRAPH)
            rendered.append(rtrim_ascii(_prefix_lines(body, text, " " * indent, "")))
        return ("\n" if tight else _BLOCK_SEPARATOR).join(rendered)

    def _item_body(self, content: list[JsonObject], *, tight: bool) -> str:
        if tight:
            return "\n".join(self._block(child) or "" for child in content)
        return self.blocks(content)

    def _image(self, attrs: JsonObject) -> str:
        source = as_text(attrs.get("src"))
        if is_embedded(source):
            self._images += 1
            source = placeholder(self._images)
        alt = as_text(attrs.get("alt"))
        title = as_text(attrs.get("title"))
        if not is_blank(attrs.get("width")) or not is_blank(attrs.get("height")):
            return _image_tag(source, alt, title, attrs)
        written_title = ' "' + title.replace('"', '\\"') + '"' if title else ""
        return f"![{_escape_text(alt, line_start=False, table=False)}]({_url(source)}{written_title})"

    def _table(self, node: JsonObject) -> str:
        rows: list[list[str]] = []
        for row in objects(children(node)):
            cells: list[str] = []
            for cell in objects(children(row)):
                cells.append(self._cell(cell))
                # A spanned cell becomes empty cells, so later columns stay aligned.
                cells.extend("" for _ in range(as_int(attribute_or(cell, "colspan", 1)) - 1))
            rows.append(cells)
        if not rows:
            return ""
        width = max(1, *(len(cells) for cells in rows))
        # GitHub's tables need a header row: the first row is it.
        lines = [_table_line(rows[0], width), "|" + _TABLE_SEPARATOR_CELL * width]
        lines.extend(_table_line(cells, width) for cells in rows[1:])
        return "\n".join(lines)

    def _cell(self, cell: JsonObject) -> str:
        parts: list[str] = []
        for block in objects(children(cell)):
            kind = node_type(block)
            if kind in ("paragraph", "heading"):
                parts.append(self._inline(children(block), table=True))
            elif kind == "image":
                parts.append(self._image(attributes(block)))
            else:
                # Lists, code and quotes cannot live in a table cell: their text stays.
                text = trim_ascii(WHITESPACE_RUNS.sub(" ", _plain_text(block)))
                parts.append(_escape_text(text, line_start=False, table=True))
        return _HTML_BREAK.join(part for part in parts if part != "")

    def _details(self, node: JsonObject) -> str:
        summary = ""
        body = ""
        for child in objects(children(node)):
            kind = node_type(child)
            if kind == "detailsSummary":
                summary = self._inline_html(children(child))
            elif kind == "detailsContent":
                body = self.blocks(children(child))
        # The blank lines end the HTML blocks, so the body is read as Markdown.
        return f"<details>\n<summary>{summary}</summary>\n\n{body or _EMPTY_PARAGRAPH}\n\n</details>"

    # ── Inline ──────────────────────────────────────────────────────────────

    def _inline(self, nodes: Sequence[JsonValue], *, table: bool = False) -> str:
        """Markdown inline content. Marks open and close like a stack, so runs that share
        marks share their delimiters."""
        out: list[str] = []
        marks = _OpenMarks()
        # Trailing whitespace, held until the marks around it close.
        pending_space = ""
        line_start = True
        for node in objects(nodes):
            kind = node_type(node)
            if kind == "hardBreak":
                out.append(marks.close_to(0))
                pending_space = ""
                out.append(_HTML_BREAK if table else _MARKDOWN_HARD_BREAK)
                line_start = True
                continue
            if kind == "image":
                out.append(marks.close_to(0) + pending_space + self._image(attributes(node)))
                pending_space = ""
                line_start = False
                continue
            if kind != "text":
                continue
            text = as_text(node.get("text")).replace("\n", " ")
            node_marks = _ordered_marks(children(node, "marks"))
            if trim_ascii(text) == "":
                pending_space += text
                continue
            if _CODE_MARK in node_marks:
                out.append(marks.close_to(0) + pending_space + _code_span(text))
                pending_space = ""
                line_start = False
                continue
            # Delimiters must hug the text: edge whitespace moves outside the marks.
            edges = _EDGE_SPACES.fullmatch(text)
            lead, core, trail = edges.groups() if edges else ("", text, "")
            keep = marks.shared(list(node_marks))
            out.append(marks.close_to(keep) + pending_space + lead)
            for key, mark in list(node_marks.items())[keep:]:
                opening, closing = _markdown_delimiters(mark)
                out.append(opening)
                marks.open(key, closing)
                line_start = False
            out.append(_escape_text(core, line_start=line_start and lead == "", table=table))
            pending_space = trail
            line_start = False
        out.append(marks.close_to(0))
        return "".join(out)

    def _inline_html(self, nodes: Sequence[JsonValue]) -> str:
        """HTML inline content, for places Markdown is not read: aligned blocks, <summary>."""
        out: list[str] = []
        marks = _OpenMarks()
        for node in objects(nodes):
            kind = node_type(node)
            if kind == "hardBreak":
                out.append(_HTML_BREAK)
                continue
            if kind != "text":
                continue
            node_marks = _ordered_marks(children(node, "marks"))
            keep = marks.shared(list(node_marks))
            out.append(marks.close_to(keep))
            for key, mark in list(node_marks.items())[keep:]:
                opening, closing = _html_tags(mark)
                out.append(opening)
                marks.open(key, closing)
            out.append(_html_escape(as_text(node.get("text")).replace("\n", " ")))
        out.append(marks.close_to(0))
        return "".join(out)


class _OpenMarks:
    """The marks open at the current point of inline content, outermost first."""

    def __init__(self) -> None:
        self._keys: list[str] = []
        self._closings: list[str] = []

    def shared(self, keys: list[str]) -> int:
        """How many of the open marks, from the outermost, the next text keeps."""
        count = 0
        while count < min(len(self._keys), len(keys)) and self._keys[count] == keys[count]:
            count += 1
        return count

    def open(self, key: str, closing: str) -> None:
        self._keys.append(key)
        self._closings.append(closing)

    def close_to(self, keep: int) -> str:
        """Closes the innermost marks until `keep` are open; returns their closing text."""
        closed: list[str] = []
        while len(self._keys) > keep:
            self._keys.pop()
            closed.append(self._closings.pop())
        return "".join(closed)


def _ordered_marks(marks: list[JsonValue]) -> dict[str, JsonObject]:
    """The known marks, keyed by type and attributes, outermost first."""
    by_type: dict[str, JsonObject] = {}
    for mark in objects(marks):
        kind = mark.get("type")
        if isinstance(kind, str) and kind in MARKS:
            by_type[kind] = mark
    # The editor's code mark excludes every other mark.
    if _CODE_MARK in by_type:
        return {_CODE_MARK: by_type[_CODE_MARK]}
    ordered: dict[str, JsonObject] = {}
    for kind in MARKS:
        known = by_type.get(kind)
        if known is None or (kind == "textStyle" and _color(known) is None):
            continue
        ordered[f"{kind}:{mapping_key(known.get('attrs'))}"] = known
    return ordered


def _markdown_delimiters(mark: JsonObject) -> _Delimiters:
    kind = node_type(mark)
    delimiter = _DELIMITED_MARKS.get(kind)
    if delimiter is not None:
        return delimiter, delimiter
    if kind == "link":
        return "[", f"]({_url(as_text(attribute(mark, 'href')))})"
    return _html_tags(mark)


def _html_tags(mark: JsonObject) -> _Delimiters:
    kind = node_type(mark)
    if kind == "link":
        return f'<a href="{_html_escape(as_text(attribute(mark, "href")))}">', "</a>"
    if kind == "textStyle":
        return f'<span style="color:{_html_escape(_color(mark) or "")}">', "</span>"
    if kind == _CODE_MARK:
        return "<code>", "</code>"
    tag = _HTML_MARK_TAGS.get(kind)
    return (f"<{tag}>", f"</{tag}>") if tag is not None else ("", "")


def _color(mark: JsonObject) -> str | None:
    """The mark's colour when it is safe to write into a style attribute."""
    color = attribute(mark, "color")
    if not isinstance(color, str) or _SAFE_COLOR.match(color) is None:
        return None
    return trim_ascii(color)


def _alignment(node: JsonObject) -> str | None:
    alignment = attribute(node, "textAlign")
    return alignment if isinstance(alignment, str) and alignment in ALIGNMENTS else None


def _is_tight(items: list[JsonObject]) -> bool:
    """A list is tight when every item is one paragraph, optionally followed by lists."""
    for item in items:
        for index, child in enumerate(children(item)):
            kind = child.get("type") if isinstance(child, dict) else None
            if index == 0 and kind != "paragraph":
                return False
            if index > 0 and kind not in LISTS:
                return False
    return True


def _code_block(node: JsonObject) -> str:
    code = "".join(as_text(child.get("text")) for child in objects(children(node)))
    fence = "`" * max(_CODE_FENCE_MIN, _longest_backtick_run(code) + 1)
    language = as_text(attribute_or(node, "language", ""))
    if _SAFE_LANGUAGE.match(language) is None:
        language = ""
    body = f"{code}\n" if code else ""
    return f"{fence}{language}\n{body}{fence}"


def _code_span(text: str) -> str:
    ticks = "`" * (_longest_backtick_run(text) + 1)
    # A code span drops one space from each end when both ends have one, and cannot
    # start or end with a backtick: padding with a space covers both.
    spaced = len(text) > 1 and text.startswith(" ") and text.endswith(" ") and text.strip(" ") != ""
    pad = " " if spaced or text.startswith("`") or text.endswith("`") else ""
    return f"{ticks}{pad}{text}{pad}{ticks}"


def _longest_backtick_run(text: str) -> int:
    return max((len(run) for run in _BACKTICK_RUNS.findall(text)), default=0)


def _image_tag(source: str, alt: str, title: str, attrs: JsonObject) -> str:
    """Markdown has no image size, so a resized image is written as an <img> tag."""
    values: dict[str, JsonValue] = {
        "alt": alt,
        "title": title,
        "width": attrs.get("width", ""),
        "height": attrs.get("height", ""),
    }
    tag = f'<img src="{_html_escape(source)}"'
    for name, value in values.items():
        if value is not None and value != "":
            tag += f' {name}="{_html_escape(as_text(value))}"'
    return tag + ">"


def _table_line(cells: list[str], width: int) -> str:
    padded = cells + [""] * (width - len(cells))
    return "| " + " | ".join(cell or _TABLE_EMPTY_CELL for cell in padded) + " |"


def _prefix_lines(text: str, first: str, rest: str, blank: str) -> str:
    """Prefixes the first line with `first` and each later one with `rest`; a blank later
    line becomes `blank`."""
    lines = text.split("\n")
    prefixed = [first + lines[0]]
    prefixed.extend(blank if line == "" else rest + line for line in lines[1:])
    return "\n".join(prefixed)


def _escape_text(text: str, *, line_start: bool, table: bool) -> str:
    """Escapes text so it reads back as the same characters, not as Markdown syntax."""
    text = _MARKDOWN_SYNTAX.sub(r"\\\1", text)
    text = _EMPHASIS_UNDERSCORE.sub(r"\\_", text)
    text = _ENTITY_START.sub(r"\\&", text)
    if table:
        text = text.replace("|", "\\|")
    if line_start:
        for pattern in _LINE_START_SYNTAX:
            text = pattern.sub(r"\1\\\2", text)
    return text


def _url(url: str) -> str:
    if _URL_NEEDS_BRACKETS.search(url) is None:
        return url
    return "<" + url.replace("<", "%3C").replace(">", "%3E") + ">"


def _html_escape(value: str) -> str:
    return value.translate(_HTML_ESCAPES)


def _plain_text(node: JsonObject) -> str:
    if node_type(node) == "text":
        return as_text(node.get("text"))
    return " ".join(_plain_text(child) for child in objects(children(node)))
