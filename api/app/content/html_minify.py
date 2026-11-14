"""Removes the formatting whitespace between HTML elements, so it never becomes text in
the document: each line is trimmed and whitespace before block tags is dropped. <pre>
blocks keep their whitespace."""

import re
from typing import Final

from app.content.text_rules import WHITESPACE_CHARACTERS, trim_ascii

_SPACE: Final = f"[{WHITESPACE_CHARACTERS}]"
_PRE_BLOCK: Final = re.compile(f"{_SPACE}*<pre(\\b[^>]*?>.*?</pre>){_SPACE}*", re.IGNORECASE | re.DOTALL)
_LINE_EDGES: Final = re.compile(f"^{_SPACE}+|{_SPACE}+$", re.MULTILINE)
_BLOCK_TAGS: Final = (
    "area|article|aside|base(?:font)?|blockquote|body|canvas|caption|center|col(?:group)?|dd|dir|div|dl|dt"
    "|fieldset|figcaption|figure|footer|form|frame(?:set)?|h[1-6]|head|header|hgroup|hr|html|legend|li|link"
    "|main|map|menu|meta|nav|ol|opt(?:group|ion)|output|p|param|section|t(?:able|body|head|d|h||r|foot|itle)"
    "|ul|video"
)
_SPACE_BEFORE_BLOCK_TAG: Final = re.compile(f"{_SPACE}+(</?(?:{_BLOCK_TAGS})\\b[^>]*>)", re.IGNORECASE)
# Placeholders for the <pre> blocks. NUL never occurs in the HTML: Markdown parsing replaces it.
_PLACEHOLDER_MARK: Final = chr(0)


def minify_html(markup: str) -> str:
    text = trim_ascii(markup).replace("\r\n", "\n")
    blocks: list[str] = []

    def reserve(match: re.Match[str]) -> str:
        blocks.append("<pre" + match.group(1))
        return f"{_PLACEHOLDER_MARK}{len(blocks) - 1}{_PLACEHOLDER_MARK}"

    text = _PRE_BLOCK.sub(reserve, text)
    text = _LINE_EDGES.sub("", text)
    text = _SPACE_BEFORE_BLOCK_TAG.sub(r"\1", text)
    for index, block in enumerate(blocks):
        text = text.replace(f"{_PLACEHOLDER_MARK}{index}{_PLACEHOLDER_MARK}", block)
    return text
