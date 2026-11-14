"""The text rules behind derived note text and search snippets. They are fixed lists
rather than Python's str.strip() and \\s, so the plain text, excerpt and word count of a
note never change with the Python or Unicode version."""

import re
import unicodedata
from typing import Final

# The characters that separate words: ASCII whitespace and the Unicode spaces. Written as the
# inside of a character class, so other patterns can build on it.
WHITESPACE_CHARACTERS: Final = (
    "\t\n\x0b\x0c\r \x85\xa0\u1680\u180e\u2000-\u200a\u2028\u2029\u202f\u205f\u3000"
)
WHITESPACE_RUNS: Final = re.compile(f"[{WHITESPACE_CHARACTERS}]+")
# Trimming removes ASCII whitespace and NUL only: a leading no-break space is content.
_TRIM_CHARACTERS: Final = " \t\n\r\0\x0b"
# Display width: East Asian wide and fullwidth characters take two columns.
_WIDE_CLASSES: Final = frozenset({"W", "F"})
_WIDE_CHARACTER_WIDTH: Final = 2
_NARROW_CHARACTER_WIDTH: Final = 1


def trim_ascii(text: str) -> str:
    return text.strip(_TRIM_CHARACTERS)


def rtrim_ascii(text: str) -> str:
    return text.rstrip(_TRIM_CHARACTERS)


def ltrim_ascii(text: str) -> str:
    return text.lstrip(_TRIM_CHARACTERS)


def collapse_whitespace(text: str) -> str:
    """Every run of whitespace becomes one space, then the ends are trimmed."""
    return trim_ascii(WHITESPACE_RUNS.sub(" ", text))


def display_width(text: str) -> int:
    return sum(_character_width(character) for character in text)


def truncate_to_width(text: str, width: int) -> str:
    """The longest start of the text that fits in width columns."""
    used = 0
    for index, character in enumerate(text):
        used += _character_width(character)
        if used > width:
            return text[:index]
    return text


def fold_case(text: str) -> str:
    """Unicode simple case folding: one character stays one character,
    so positions in the folded text are positions in the original."""
    return "".join(_fold_character(character) for character in text)


def _character_width(character: str) -> int:
    if unicodedata.east_asian_width(character) in _WIDE_CLASSES:
        return _WIDE_CHARACTER_WIDTH
    return _NARROW_CHARACTER_WIDTH


def _fold_character(character: str) -> str:
    for folded in (character.casefold(), character.lower()):
        if len(folded) == 1:
            return folded
    return character
