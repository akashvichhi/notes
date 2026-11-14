"""Markdown to HTML: CommonMark with GitHub's tables, strikethrough, task lists and
autolinks. Raw HTML is allowed, because it is how Markdown carries what it has no syntax
for (underline, colour, alignment, details); only what the editor's schema knows survives
the HTML-to-document step."""

import re
from collections.abc import Sequence
from typing import Final, Protocol

from linkify_it import LinkifyIt
from markdown_it import MarkdownIt
from markdown_it.renderer import RendererProtocol
from markdown_it.rules_core import StateCore
from markdown_it.token import Token
from markdown_it.utils import EnvType, OptionsDict
from mdit_py_plugins.tasklists import tasklists_plugin

from app.constants.content_constants import MARKDOWN_MAX_NESTING

# Raw HTML tags that change how a browser reads what follows them are written as text
# (GitHub's tag filter).
_FILTERED_TAG: Final = re.compile(
    r"<(/?(?:title|textarea|style|xmp|iframe|noembed|noframes|script|plaintext)(?:[ \t\n\x0b\x0c\r/>]|$))",
    re.IGNORECASE,
)
# Characters a browser drops before reading a URL's scheme, so they cannot hide one.
_URL_DROPPED: Final = re.compile("[\t\n\r]")
_URL_LEADING: Final = "".join(chr(code) for code in range(0x21))
_UNSAFE_SCHEME: Final = re.compile("(?:javascript|vbscript|file|data):", re.IGNORECASE)
_SAFE_DATA_URL: Final = re.compile("data:image/(?:png|gif|jpeg|webp)", re.IGNORECASE)
# The links GitHub turns plain text into: URLs with these schemes, www. addresses, emails.
_AUTOLINK_SCHEMES: Final = frozenset({"http:", "https:", "ftp:", "mailto:"})
_WWW: Final = "www."


class _LinkMatch(Protocol):
    schema: str
    text: str


class _GithubAutolinks:
    """linkify-it limited to the links GitHub makes: a bare domain such as example.com,
    or a protocol-relative //example.com, stays text."""

    def __init__(self) -> None:
        self._linkify = LinkifyIt()

    def pretest(self, text: str) -> bool:
        return bool(self._linkify.pretest(text))

    def test(self, text: str) -> bool:
        return bool(self._linkify.test(text))

    def match(self, text: str) -> list[_LinkMatch] | None:
        found: list[_LinkMatch] = self._linkify.match(text) or []
        kept = [link for link in found if _is_github_autolink(link)]
        return kept or None

    def match_at_start(self, text: str) -> _LinkMatch | None:
        found: _LinkMatch | None = self._linkify.match_at_start(text)
        return found


class _NotesMarkdownIt(MarkdownIt):
    def validateLink(self, url: str) -> bool:  # noqa: N802 - markdown-it's name
        # Every link is kept, so its text survives: unsafe URLs are removed after parsing.
        return True


def markdown_to_html(markdown: str) -> str:
    html: str = _MARKDOWN.render(markdown)
    return html


def is_unsafe_url(url: str) -> bool:
    cleaned = _URL_DROPPED.sub("", url).lstrip(_URL_LEADING)
    return _UNSAFE_SCHEME.match(cleaned) is not None and _SAFE_DATA_URL.match(cleaned) is None


def _is_github_autolink(link: _LinkMatch) -> bool:
    if link.schema in _AUTOLINK_SCHEMES:
        return True
    return link.schema == "" and link.text.lower().startswith(_WWW)


def _remove_unsafe_urls(state: StateCore) -> None:
    """A link with an unsafe URL keeps its text without the link; an image keeps no source."""
    for token in state.tokens:
        for child in token.children or []:
            if child.type == "link_open" and is_unsafe_url(str(child.attrGet("href") or "")):
                child.attrs.pop("href", None)
            elif child.type == "image" and is_unsafe_url(str(child.attrGet("src") or "")):
                child.attrSet("src", "")


def _soft_break(
    _renderer: RendererProtocol, _tokens: Sequence[Token], _index: int, _options: OptionsDict, _env: EnvType
) -> str:
    # A soft line break is a space in the editor, never a newline in a text node.
    return " "


def _raw_html(
    _renderer: RendererProtocol, tokens: Sequence[Token], index: int, _options: OptionsDict, _env: EnvType
) -> str:
    return _FILTERED_TAG.sub(r"&lt;\1", tokens[index].content)


def _build_markdown() -> MarkdownIt:
    markdown = _NotesMarkdownIt(
        "commonmark",
        {
            "html": True,
            "linkify": True,
            "maxNesting": MARKDOWN_MAX_NESTING,
            "strikethrough_single_tilde": True,
        },
    )
    markdown.enable(["table", "strikethrough", "linkify"])
    markdown.linkify = _GithubAutolinks()
    markdown.use(tasklists_plugin)
    markdown.core.ruler.push("remove_unsafe_urls", _remove_unsafe_urls)
    markdown.add_render_rule("softbreak", _soft_break)
    markdown.add_render_rule("html_block", _raw_html)
    markdown.add_render_rule("html_inline", _raw_html)
    return markdown


# Built once: rendering keeps no state between calls.
_MARKDOWN: Final = _build_markdown()
