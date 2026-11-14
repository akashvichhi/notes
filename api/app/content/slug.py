"""Tag slugs, exactly as the Laravel API's Str::slug made them, so a tag typed again after
the migration finds the slug already in the database.

data/ascii_replacements.json is the English replacement map of voku/portable-ascii 2.1.1
(MIT licence), which Str::slug transliterates with. Scripts it has no entry for (Chinese,
Japanese, Korean, Hebrew, ...) are dropped, as they were before."""

import json
import re
from pathlib import Path
from typing import Final

_REPLACEMENTS: Final[dict[str, str]] = json.loads(
    (Path(__file__).parent / "data" / "ascii_replacements.json").read_text(encoding="utf-8")
)
# Longest key first: like PHP's strtr, a two-letter Greek digraph wins over its first letter.
_REPLACEMENT_PATTERN: Final = re.compile(
    "|".join(re.escape(key) for key in sorted(_REPLACEMENTS, key=len, reverse=True))
)
_LINE_BREAKS_AND_TABS: Final = re.compile(r"\r\n|[\n\r\t]")
# portable-ascii's own list of characters it keeps (\x10 and \x13 included).
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
