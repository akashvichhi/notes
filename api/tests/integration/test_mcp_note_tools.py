from datetime import timedelta
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.note_model import Note
from app.models.user_model import User
from app.schemas.common.json_types import JsonObject
from tests.factories import make_folder, make_note, make_tag
from tests.fakes import START_TIME
from tests.mcp_client import McpClient

SUMMARY_FIELDS = {"uuid", "title", "folder_id", "folder", "tags", "starred", "excerpt", "updated_at"}
FULL_FIELDS = (SUMMARY_FIELDS - {"excerpt"}) | {"version", "created_at", "word_count", "markdown"}
IMAGE = "data:image/png;base64,iVBORw0KGgo="
NOTE_TAGS_MAX = 50


def _paragraph(text: str) -> JsonObject:
    return {"type": "paragraph", "content": [{"type": "text", "text": text}]}


def _doc(*blocks: JsonObject) -> JsonObject:
    return {"type": "doc", "content": list(blocks)}


def _stored(db_session: Session, uuid: object) -> Note:
    db_session.expire_all()
    note = db_session.scalar(select(Note).where(Note.uuid == UUID(str(uuid))))
    assert note is not None
    return note


# ── get_note ─────────────────────────────────────────────────────────────────


def test_get_note_returns_the_body_as_markdown(mcp: McpClient, db_session: Session, user: User) -> None:
    parent = make_folder(db_session, user, name="Work")
    folder = make_folder(db_session, user, name="Projects", parent=parent)
    note = make_note(db_session, user, title="Plan", folder=folder, body=_doc(_paragraph("Hello world")))
    note.tags = [make_tag(db_session, user, name="Ideas")]
    db_session.flush()

    data = mcp.ok("get_note", uuid=str(note.uuid))

    assert set(data) == FULL_FIELDS
    assert data["markdown"] == "Hello world"
    assert data["title"] == "Plan"
    assert data["folder_id"] == str(folder.uuid)
    assert data["folder"] == "Work / Projects"
    assert data["tags"] == ["Ideas"]
    assert data["starred"] is False
    assert data["version"] == note.version


def test_get_note_shows_embedded_images_as_placeholders(
    mcp: McpClient, db_session: Session, user: User
) -> None:
    image: JsonObject = {"type": "image", "attrs": {"src": IMAGE, "alt": "chart"}}
    note = make_note(db_session, user, body=_doc(image))

    assert mcp.ok("get_note", uuid=str(note.uuid))["markdown"] == "![chart](note-image:1)"


def test_a_note_in_the_trash_cannot_be_read(mcp: McpClient, db_session: Session, user: User) -> None:
    note = make_note(db_session, user, title="Gone")
    note.deleted_at = START_TIME
    db_session.flush()

    assert "No note with that uuid" in mcp.error("get_note", uuid=str(note.uuid))


# ── list_notes and search_notes ──────────────────────────────────────────────


def test_list_notes_pages_through_notes_without_bodies(
    mcp: McpClient, db_session: Session, user: User
) -> None:
    for number in range(3):
        make_note(db_session, user, title=f"Note {number}")
    trashed = make_note(db_session, user, title="Trashed")
    trashed.deleted_at = START_TIME
    db_session.flush()

    data = mcp.ok("list_notes", per_page=2, sort="title")

    notes = data["notes"]
    assert isinstance(notes, list)
    assert [note["title"] for note in notes] == ["Note 0", "Note 1"]
    assert set(notes[0]) == SUMMARY_FIELDS
    assert (data["page"], data["per_page"], data["total"], data["last_page"]) == (1, 2, 3, 2)


def test_list_notes_filters_by_folder_tag_and_star(mcp: McpClient, db_session: Session, user: User) -> None:
    folder = make_folder(db_session, user, name="Work")
    in_folder = make_note(db_session, user, title="In folder", folder=folder)
    tagged = make_note(db_session, user, title="Tagged")
    tagged.tags = [make_tag(db_session, user, name="Read Later", slug="read-later")]
    starred = make_note(db_session, user, title="Starred")
    starred.is_starred = True
    db_session.flush()

    def titles(**filters: object) -> list[object]:
        notes = mcp.ok("list_notes", **filters)["notes"]
        assert isinstance(notes, list)
        return [note["title"] for note in notes]

    assert titles(folder_id=str(folder.uuid)) == [in_folder.title]
    assert titles(tag="read later") == [tagged.title]
    assert titles(starred=True) == [starred.title]


def test_list_notes_in_an_unknown_folder_fails(mcp: McpClient) -> None:
    error = mcp.error("list_notes", folder_id="0190a000-0000-7000-8000-000000000000")

    assert "No folder with that id" in error


def test_search_notes_returns_matches_with_an_excerpt(
    mcp: McpClient, db_session: Session, user: User
) -> None:
    match = make_note(db_session, user, title="Garden", plain_text="Plant tomatoes in spring")
    make_note(db_session, user, title="Other", plain_text="Nothing here")

    data = mcp.ok("search_notes", query="tomato")

    assert data["query"] == "tomato"
    assert data["count"] == 1
    notes = data["notes"]
    assert isinstance(notes, list)
    assert notes[0]["uuid"] == str(match.uuid)
    assert "tomatoes" in notes[0]["excerpt"]


def test_search_notes_ignores_words_shorter_than_three_characters(
    mcp: McpClient, db_session: Session, user: User
) -> None:
    make_note(db_session, user, title="An ox", plain_text="an ox")

    assert mcp.ok("search_notes", query="an ox")["count"] == 0


# ── create_note and update_note ──────────────────────────────────────────────


def test_create_note_writes_the_title_markdown_folder_and_tags(
    mcp: McpClient, db_session: Session, user: User
) -> None:
    folder = make_folder(db_session, user, name="Work")

    data = mcp.ok(
        "create_note",
        title="Meeting",
        markdown="# Agenda\n\n- **Budget**",
        folder_id=str(folder.uuid),
        tags=["Team", "team", " "],
    )

    assert data["title"] == "Meeting"
    assert data["folder_id"] == str(folder.uuid)
    assert data["tags"] == ["Team"]
    note = _stored(db_session, data["uuid"])
    assert note.title_locked is True
    assert note.version == data["version"]
    assert mcp.ok("get_note", uuid=str(data["uuid"]))["markdown"] == "# Agenda\n\n- **Budget**"


def test_create_note_with_unusable_markdown_creates_nothing(
    mcp: McpClient, db_session: Session, user: User
) -> None:
    error = mcp.error("create_note", title="Bad", markdown="![x](note-image:1)")

    assert "Unknown image placeholder" in error
    assert db_session.scalar(select(Note).where(Note.user_id == user.id)) is None


def test_update_note_replaces_the_body_and_moves_the_version_on(
    mcp: McpClient, db_session: Session, user: User
) -> None:
    note = make_note(db_session, user, title="Kept", body=_doc(_paragraph("Old")))
    note.title_locked = True
    db_session.flush()

    data = mcp.ok("update_note", uuid=str(note.uuid), version=note.version, markdown="New *text*")

    stored = _stored(db_session, note.uuid)
    assert data["version"] == stored.version == 2
    assert stored.title == "Kept"
    assert mcp.ok("get_note", uuid=str(note.uuid))["markdown"] == "New *text*"


def test_update_note_can_append_or_prepend_without_rewriting_the_rest(
    mcp: McpClient, db_session: Session, user: User
) -> None:
    image: JsonObject = {"type": "image", "attrs": {"src": IMAGE}}
    note = make_note(db_session, user, body=_doc(_paragraph("Middle"), image, {"type": "paragraph"}))

    mcp.ok("update_note", uuid=str(note.uuid), version=1, markdown="End", mode="append")
    mcp.ok("update_note", uuid=str(note.uuid), version=2, markdown="Start", mode="prepend")

    body = _stored(db_session, note.uuid).body
    assert body["content"] == [_paragraph("Start"), _paragraph("Middle"), image, _paragraph("End")]


def test_update_note_keeps_images_named_by_their_placeholder(
    mcp: McpClient, db_session: Session, user: User
) -> None:
    note = make_note(db_session, user, body=_doc({"type": "image", "attrs": {"src": IMAGE}}))

    mcp.ok("update_note", uuid=str(note.uuid), version=1, markdown="Look\n\n![](note-image:1)")

    content = _stored(db_session, note.uuid).body["content"]

    assert isinstance(content, list)
    image = content[1]
    assert isinstance(image, dict)
    assert image["type"] == "image"
    attrs = image["attrs"]
    assert isinstance(attrs, dict)
    assert attrs["src"] == IMAGE


def test_update_note_with_a_stale_version_is_refused(mcp: McpClient, db_session: Session, user: User) -> None:
    note = make_note(db_session, user, body=_doc(_paragraph("Current")))
    note.version = 3
    db_session.flush()

    error = mcp.error("update_note", uuid=str(note.uuid), version=2, markdown="Mine")

    assert "it is now at version 3" in error
    assert _stored(db_session, note.uuid).body == _doc(_paragraph("Current"))


def test_update_note_can_change_only_the_title(mcp: McpClient, db_session: Session, user: User) -> None:
    note = make_note(db_session, user, title="Old", body=_doc(_paragraph("Body")))

    data = mcp.ok("update_note", uuid=str(note.uuid), version=1, title="  New  ")

    stored = _stored(db_session, note.uuid)
    assert data["title"] == stored.title == "New"
    assert stored.title_locked is True
    assert stored.version == 1


def test_update_note_needs_a_title_or_markdown(mcp: McpClient, db_session: Session, user: User) -> None:
    note = make_note(db_session, user)

    assert "Nothing to change" in mcp.error("update_note", uuid=str(note.uuid), version=1)


def test_a_note_in_the_trash_cannot_be_changed(mcp: McpClient, db_session: Session, user: User) -> None:
    note = make_note(db_session, user)
    note.deleted_at = START_TIME - timedelta(days=1)
    db_session.flush()

    error = mcp.error("update_note", uuid=str(note.uuid), version=1, title="New")

    assert "This note is in Trash" in error


# ── Moving, starring and copying ─────────────────────────────────────────────


def test_move_note_into_a_folder_and_out_again(mcp: McpClient, db_session: Session, user: User) -> None:
    folder = make_folder(db_session, user, name="Work")
    note = make_note(db_session, user)

    assert mcp.ok("move_note", uuid=str(note.uuid), folder_id=str(folder.uuid))["folder"] == "Work"
    moved_out = mcp.ok("move_note", uuid=str(note.uuid), folder_id=None)

    assert moved_out["folder_id"] is None
    assert moved_out["folder"] is None


def test_set_note_starred(mcp: McpClient, db_session: Session, user: User) -> None:
    note = make_note(db_session, user)

    assert mcp.ok("set_note_starred", uuid=str(note.uuid), starred=True)["starred"] is True
    assert _stored(db_session, note.uuid).is_starred is True


def test_duplicate_note_copies_the_body_and_tags(mcp: McpClient, db_session: Session, user: User) -> None:
    note = make_note(db_session, user, title="Recipe", body=_doc(_paragraph("Flour")))
    note.title_locked = True
    note.tags = [make_tag(db_session, user, name="Food")]
    db_session.flush()

    data = mcp.ok("duplicate_note", uuid=str(note.uuid))

    assert data["uuid"] != str(note.uuid)
    assert data["title"] == "Recipe (copy)"
    assert data["tags"] == ["Food"]
    assert _stored(db_session, data["uuid"]).body == _doc(_paragraph("Flour"))


# ── Tags on a note ───────────────────────────────────────────────────────────


def test_set_add_and_remove_note_tags(mcp: McpClient, db_session: Session, user: User) -> None:
    note = make_note(db_session, user)
    uuid = str(note.uuid)

    assert mcp.ok("set_note_tags", uuid=uuid, tags=["Work", "Ideas"])["tags"] == ["Ideas", "Work"]
    assert mcp.ok("add_note_tags", uuid=uuid, tags=["work", "Later"])["tags"] == ["Ideas", "Later", "Work"]
    assert mcp.ok("remove_note_tags", uuid=uuid, tags=["IDEAS"])["tags"] == ["Later", "Work"]
    assert mcp.ok("set_note_tags", uuid=uuid, tags=[])["tags"] == []
    assert "Ideas" in [tag["name"] for tag in _tag_list(mcp)]


def test_a_note_can_have_at_most_fifty_tags(mcp: McpClient, db_session: Session, user: User) -> None:
    note = make_note(db_session, user)
    mcp.ok("set_note_tags", uuid=str(note.uuid), tags=[f"tag {n}" for n in range(NOTE_TAGS_MAX)])

    error = mcp.error("add_note_tags", uuid=str(note.uuid), tags=["one more"])

    assert f"at most {NOTE_TAGS_MAX} tags" in error


def _tag_list(mcp: McpClient) -> list[dict[str, object]]:
    tags = mcp.ok("list_tags")["tags"]
    assert isinstance(tags, list)
    return tags
