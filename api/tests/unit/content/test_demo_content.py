from app.content.demo_content import DemoFolder, load_demo_content
from app.content.note_text import derive_note_text

# The app is a web app only (docs/requirements.md, out of scope): no desktop or mobile apps.
MISSING_FEATURES = (
    "desktop",
    "mobile",
    "phone",
    "tablet",
    "on a mac",
    "android",
    "emulator",
    "system tray",
    "offline",
    "progressive web app",
)


def test_demo_content_has_the_ideas_personal_and_work_folders_with_their_colours() -> None:
    assert load_demo_content().folders == (
        DemoFolder(name="Ideas", color="#fab005"),
        DemoFolder(name="Personal", color="#40c057"),
        DemoFolder(name="Work", color="#7950f2"),
    )


def test_demo_content_has_the_seven_sample_notes_in_list_order() -> None:
    titles = [note.title for note in load_demo_content().notes]

    assert titles == [
        "Q4 product roadmap",
        "Weekly team sync, 12 Nov",
        "Launch checklist",
        "Trip to Udaipur",
        "Masala chai",
        "Books to read",
        "Ideas for the side project",
    ]


def test_demo_content_stars_the_roadmap_and_the_recipe() -> None:
    starred = [note.title for note in load_demo_content().notes if note.starred]

    assert starred == ["Q4 product roadmap", "Masala chai"]


def test_demo_content_uses_seven_tags() -> None:
    tags = {tag for note in load_demo_content().notes for tag in note.tags}

    assert tags == {"planning", "product", "meetings", "travel", "recipes", "reading", "ideas"}


def test_every_sample_note_is_a_document_in_a_listed_folder() -> None:
    content = load_demo_content()
    folder_names = {folder.name for folder in content.folders}

    for note in content.notes:
        assert note.body["type"] == "doc"
        assert derive_note_text(note.body).plain_text != ""
        assert note.folder is None or note.folder in folder_names


def test_sample_notes_never_mention_features_the_app_does_not_have() -> None:
    for note in load_demo_content().notes:
        text = f"{note.title} {derive_note_text(note.body).plain_text}".lower()
        assert not [feature for feature in MISSING_FEATURES if feature in text]
