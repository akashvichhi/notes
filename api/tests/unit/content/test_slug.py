import json
from pathlib import Path

import pytest

from app.content.slug import slugify

# Generated from the Laravel API's Str::slug: tag slugs already in the database came
# from it, so a tag typed again after the migration must find the same slug.
GOLDEN_CASES = json.loads((Path(__file__).parents[2] / "golden" / "slugs.json").read_text(encoding="utf-8"))


@pytest.mark.parametrize(
    ("name", "slug"),
    [(case["name"], case["slug"]) for case in GOLDEN_CASES],
    ids=[f"case{index}" for index in range(len(GOLDEN_CASES))],
)
def test_slug_matches_the_previous_api(name: str, slug: str) -> None:
    assert slugify(name) == slug


def test_slug_drops_accents_and_joins_words_with_dashes() -> None:
    assert slugify("  Café   crème_brûlée ") == "cafe-creme-brulee"


def test_slug_spells_out_the_at_sign() -> None:
    assert slugify("email@home") == "email-at-home"


def test_slug_transliterates_cyrillic_and_greek() -> None:
    assert (slugify("Привет мир"), slugify("Ελληνικά")) == ("privet-mir", "ellinika")


def test_slug_of_a_script_without_a_latin_spelling_is_empty() -> None:
    assert slugify("日本語") == ""
