"""The PHP string rules the Laravel API derived note text with, so notes saved before and
after the migration agree. Python's own versions differ at the edges: str.strip() and
\\s cover more characters than PHP's trim() and /\\s/u, and len() ignores display width."""

import re
import unicodedata
from typing import Final

# What PHP's /\s/u matches (PCRE with Unicode properties), listed by PHP itself.
_PHP_WHITESPACE: Final = "\t\n\x0b\x0c\r \x85\xa0\u1680\u180e\u2000-\u200a\u2028\u2029\u202f\u205f\u3000"
PHP_WHITESPACE_RUNS: Final = re.compile(f"[{_PHP_WHITESPACE}]+")
# PHP's trim() default: ASCII whitespace and NUL only.
_PHP_TRIM_CHARACTERS: Final = " \t\n\r\0\x0b"
# mb_strwidth: East Asian wide and fullwidth characters take two columns.
_WIDE_CLASSES: Final = frozenset({"W", "F"})
_WIDE_CHARACTER_WIDTH: Final = 2
_NARROW_CHARACTER_WIDTH: Final = 1


def php_trim(text: str) -> str:
    return text.strip(_PHP_TRIM_CHARACTERS)


def php_rtrim(text: str) -> str:
    return text.rstrip(_PHP_TRIM_CHARACTERS)


def collapse_whitespace(text: str) -> str:
    """trim(preg_replace('/\\s+/u', ' ', $text))."""
    return php_trim(PHP_WHITESPACE_RUNS.sub(" ", text))


def display_width(text: str) -> int:
    return sum(_character_width(character) for character in text)


def truncate_to_width(text: str, width: int) -> str:
    """mb_strimwidth($text, 0, $width, ''): the longest start that fits in width columns."""
    used = 0
    for index, character in enumerate(text):
        used += _character_width(character)
        if used > width:
            return text[:index]
    return text


def fold_case(text: str) -> str:
    """Unicode simple case folding, as mb_stripos uses: one character stays one character,
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
