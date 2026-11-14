"""Lenient reads of note body values. A body is stored as the editor sent it, so any
attribute can hold any JSON value; these reads turn an odd value into the nearest sensible
one instead of failing, so one malformed node never makes a whole note unreadable."""

import json
import math
import re
from collections.abc import Sequence
from typing import Final

from app.schemas.common.json_types import JsonObject, JsonValue

_NUMBER: Final = r"[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?"
_SPACES: Final = r"[ \t\n\r\x0b\x0c]*"
# A number at the start of a string, as in " 12px" or "1.5e1".
_LEADING_NUMBER: Final = re.compile(f"{_SPACES}({_NUMBER})")
_WHOLE_NUMBER: Final = re.compile(f"{_SPACES}{_NUMBER}{_SPACES}")
_INT_MAX: Final = 2**63 - 1
_INT_MIN: Final = -(2**63)
# The blank values: a missing attribute and these all mean "not set".
_BLANK_TEXTS: Final = frozenset({"", "0"})


def as_int(value: JsonValue) -> int:
    """The value as a whole number: numbers are truncated, text is read up to its first
    non-numeric character, and anything else is 0 (or 1 for a non-empty list)."""
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, int):
        return _clamp(value)
    if isinstance(value, float):
        return _float_to_int(value) if not math.isnan(value) else 0
    if isinstance(value, str):
        match = _LEADING_NUMBER.match(value)
        return _float_to_int(float(match.group(1))) if match else 0
    return 1 if value else 0


def as_text(value: JsonValue) -> str:
    """The value as text: missing is empty, true is "1", false is empty, numbers are
    written out, and lists and objects carry no text."""
    if value is None or value is False:
        return ""
    if value is True:
        return "1"
    if isinstance(value, str):
        return value
    if isinstance(value, int):
        return str(value)
    if isinstance(value, float):
        return str(int(value)) if value.is_integer() else repr(value)
    return ""


def is_blank(value: JsonValue) -> bool:
    """Missing, false, zero, empty text, "0" and empty lists and objects are blank."""
    if isinstance(value, str):
        return value in _BLANK_TEXTS
    return not value


def is_numeric(value: JsonValue) -> bool:
    if isinstance(value, bool):
        return False
    if isinstance(value, int | float):
        return True
    return isinstance(value, str) and _WHOLE_NUMBER.fullmatch(value) is not None


def mapping_key(value: JsonValue) -> str:
    """A stable text key for comparing attribute sets: missing and empty are the same."""
    return json.dumps(value) if value else "[]"


def node_type(node: JsonObject) -> str:
    """The node's type, or "" when it has none or it is not text."""
    value = node.get("type")
    return value if isinstance(value, str) else ""


def has_type(value: JsonValue) -> bool:
    return isinstance(value, dict) and value.get("type") is not None


def attribute(node: JsonValue, name: str) -> JsonValue:
    if not isinstance(node, dict):
        return None
    attrs = node.get("attrs")
    return attrs.get(name) if isinstance(attrs, dict) else None


def attribute_or(node: JsonValue, name: str, default: JsonValue) -> JsonValue:
    """The attribute, or the default when it is missing or null."""
    value = attribute(node, name)
    return value if value is not None else default


def attributes(node: JsonObject) -> JsonObject:
    attrs = node.get("attrs")
    return attrs if isinstance(attrs, dict) else {}


def children(node: JsonValue, key: str = "content") -> list[JsonValue]:
    """The node's child list (content or marks); an object counts as the list of its values."""
    if not isinstance(node, dict):
        return []
    value = node.get(key)
    if isinstance(value, list):
        return value
    if isinstance(value, dict):
        return list(value.values())
    return []


def objects(values: Sequence[JsonValue]) -> list[JsonObject]:
    """The values that are objects, in order."""
    return [value for value in values if isinstance(value, dict)]


def _clamp(number: int) -> int:
    return max(_INT_MIN, min(_INT_MAX, number))


def _float_to_int(number: float) -> int:
    if math.isinf(number):
        return _INT_MAX if number > 0 else _INT_MIN
    return _clamp(int(number))
