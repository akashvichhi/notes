"""Tag slugs: the name transliterated to ASCII, lowercased, with "@" spelled "at" and
words joined by "-". Tags are unique by slug, so "Side Projects" and "side_projects"
are one tag.

data/ascii_replacements.json is the transliteration table, taken from the portable-ascii
project (MIT licence). Scripts it has no entry for (Chinese, Japanese, Korean, Hebrew,
...) are dropped, so a name written only in them has no slug."""

import json
import re
from pathlib import Path
from typing import Final

_REPLACEMENTS: Final[dict[str, str]] = json.loads(
    (Path(__file__).parent / "data" / "ascii_replacements.json").read_text(encoding="utf-8")
)
# Longest key first, so a two-letter Greek digraph wins over its first letter.
_REPLACEMENT_PATTERN: Final = re.compile(
    "|".join(re.escape(key) for key in sorted(_REPLACEMENTS, key=len, reverse=True))
)
_LINE_BREAKS_AND_TABS: Final = re.compile(r"\r\n|[\n\r\t]")
# What transliterated text may keep: the table's own list, \x10 and \x13 included.
_UNSUPPORTED_CHARACTERS: Final = re.compile(r"[^\x09\x10\x13\x0A\x0D\x20-\x7E]")
_UNDERSCORES: Final = re.compile(r"_+")
_NOT_SLUG_CHARACTERS: Final = re.compile(r"[^-a-z0-9\s]+")
_DASHES_AND_SPACES: Final = re.compile(r"[-\s]+")
_SEPARATOR: Final = "-"
_AT_SIGN: Final = "@"
_AT_SIGN_WORD: Final = "-at-"


def slugify(text: str) -> str:
    ascii_text = _to_ascii(text)
    ascii_text = _UNDERSCORES.sub(_SEPARATOR, ascii_text)
    ascii_text = ascii_text.replace(_AT_SIGN, _AT_SIGN_WORD)
    ascii_text = _NOT_SLUG_CHARACTERS.sub("", ascii_text.lower())
    return _DASHES_AND_SPACES.sub(_SEPARATOR, ascii_text).strip(_SEPARATOR)


def _to_ascii(text: str) -> str:
    replaced = _REPLACEMENT_PATTERN.sub(lambda match: _REPLACEMENTS[match.group()], text)
    return _UNSUPPORTED_CHARACTERS.sub("", _LINE_BREAKS_AND_TABS.sub(" ", replaced))
