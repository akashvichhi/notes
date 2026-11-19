from app.content.demo_content import load_demo_content
from app.content.note_text import derive_note_text

# The app is a web app only (docs/requirements.md, out of scope): no desktop or mobile apps.
MISSING_FEATURES = (
    "desktop",
    "mobile",
    "phone",
    "tablet",
    "on a mac",
    "android",
    "offline",
    "progressive web app",
)


def test_demo_content_has_the_ideas_personal_and_work_folders() -> None:
    assert load_demo_content().folders == ("Ideas", "Personal", "Work")


def test_demo_content_has_seven_notes_two_of_them_starred() -> None:
    notes = load_demo_content().notes

    assert len(notes) == 7
    assert sum(note.starred for note in notes) == 2


def test_demo_content_uses_a_few_tags() -> None:
    tags = {tag for note in load_demo_content().notes for tag in note.tags}

    assert 3 <= len(tags) <= 6


def test_every_sample_note_is_a_titled_document_in_a_listed_folder() -> None:
    content = load_demo_content()

    for note in content.notes:
        assert note.body["type"] == "doc"
        assert derive_note_text(note.body).title != ""
        assert note.folder is None or note.folder in content.folders


def test_sample_notes_never_mention_features_the_app_does_not_have() -> None:
    for note in load_demo_content().notes:
        text = derive_note_text(note.body).plain_text.lower()
        assert not [feature for feature in MISSING_FEATURES if feature in text]
