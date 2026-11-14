from sqlalchemy.orm import Session

from app.models.user_model import User
from tests.factories import make_folder, make_note, make_tag, make_user
from tests.fakes import START_TIME
from tests.mcp_client import McpClient

FOLDER_FIELDS = {"id", "name", "path", "color", "position"}
TAG_FIELDS = {"id", "name", "slug"}
UNKNOWN_ID = "0190a000-0000-7000-8000-000000000000"


# ── Folders ──────────────────────────────────────────────────────────────────


def test_list_folders_returns_the_tree_with_note_counts(
    mcp: McpClient, db_session: Session, user: User
) -> None:
    work = make_folder(db_session, user, name="Work", position=1)
    home = make_folder(db_session, user, name="Home", position=0)
    projects = make_folder(db_session, user, name="Projects", parent=work)
    make_note(db_session, user, folder=projects)
    make_note(db_session, user, folder=work)
    make_note(db_session, user)
    trashed = make_note(db_session, user, folder=work)
    trashed.deleted_at = START_TIME
    make_folder(db_session, make_user(db_session), name="Not mine")
    db_session.flush()

    data = mcp.ok("list_folders")

    assert data["folders"] == [
        {"id": str(home.uuid), "name": "Home", "color": None, "position": 0, "note_count": 0, "children": []},
        {
            "id": str(work.uuid),
            "name": "Work",
            "color": None,
            "position": 1,
            "note_count": 1,
            "children": [
                {
                    "id": str(projects.uuid),
                    "name": "Projects",
                    "color": None,
                    "position": 0,
                    "note_count": 1,
                    "children": [],
                }
            ],
        },
    ]
    assert data["notes_outside_folders"] == 1
    assert data["total_notes"] == 3


def test_create_folder_at_the_top_level_or_inside_another(
    mcp: McpClient, db_session: Session, user: User
) -> None:
    top = mcp.ok("create_folder", name="  Work  ", color="#aabbcc")
    child = mcp.ok("create_folder", name="Projects", parent_id=str(top["id"]))

    assert set(top) == FOLDER_FIELDS
    assert (top["name"], top["path"], top["color"]) == ("Work", "Work", "#aabbcc")
    assert child["path"] == "Work / Projects"


def test_create_folder_refuses_a_taken_name_or_an_unknown_parent(
    mcp: McpClient, db_session: Session, user: User
) -> None:
    make_folder(db_session, user, name="Work")

    assert "The name has already been taken." in mcp.error("create_folder", name="work")
    assert "No folder with that id" in mcp.error("create_folder", name="New", parent_id=UNKNOWN_ID)


def test_rename_recolour_and_reorder_a_folder(mcp: McpClient, db_session: Session, user: User) -> None:
    folder = make_folder(db_session, user, name="Old")
    folder_id = str(folder.uuid)

    assert mcp.ok("rename_folder", id=folder_id, name="New")["name"] == "New"
    assert mcp.ok("set_folder_color", id=folder_id, color="#112233")["color"] == "#112233"
    assert mcp.ok("set_folder_color", id=folder_id, color=None)["color"] is None
    assert mcp.ok("reorder_folder", id=folder_id, position=4)["position"] == 4


def test_set_folder_color_refuses_a_colour_that_is_not_hex(
    mcp: McpClient, db_session: Session, user: User
) -> None:
    folder = make_folder(db_session, user)

    assert mcp.call("set_folder_color", id=str(folder.uuid), color="red").is_error


def test_another_users_folder_is_not_found(mcp: McpClient, db_session: Session) -> None:
    other = make_folder(db_session, make_user(db_session))

    assert "No folder with that id" in mcp.error("rename_folder", id=str(other.uuid), name="Mine")


# ── Tags ─────────────────────────────────────────────────────────────────────


def test_list_tags_counts_notes_outside_the_trash(mcp: McpClient, db_session: Session, user: User) -> None:
    work = make_tag(db_session, user, name="Work", slug="work")
    ideas = make_tag(db_session, user, name="Ideas", slug="ideas")
    note = make_note(db_session, user)
    trashed = make_note(db_session, user)
    trashed.deleted_at = START_TIME
    note.tags = [work]
    trashed.tags = [work, ideas]
    db_session.flush()

    assert mcp.ok("list_tags")["tags"] == [
        {"id": str(ideas.uuid), "name": "Ideas", "slug": "ideas", "note_count": 0},
        {"id": str(work.uuid), "name": "Work", "slug": "work", "note_count": 1},
    ]


def test_create_and_rename_a_tag(mcp: McpClient) -> None:
    tag = mcp.ok("create_tag", name="Read Later")
    renamed = mcp.ok("rename_tag", id=str(tag["id"]), name="Read Soon")

    assert set(tag) == TAG_FIELDS
    assert tag["slug"] == "read-later"
    assert (renamed["name"], renamed["slug"]) == ("Read Soon", "read-soon")


def test_create_tag_refuses_a_name_whose_slug_is_taken(
    mcp: McpClient, db_session: Session, user: User
) -> None:
    make_tag(db_session, user, name="Work", slug="work")

    assert "The name has already been taken." in mcp.error("create_tag", name="WORK")


def test_an_unknown_tag_is_not_found(mcp: McpClient) -> None:
    assert "No tag with that id" in mcp.error("rename_tag", id=UNKNOWN_ID, name="New")
