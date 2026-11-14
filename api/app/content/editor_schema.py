"""The node and mark names of the editor
(web/src/pages/notes/components/editor/editor_extensions.ts), as its ProseMirror JSON
spells them. Keep the two in step: a node missing here is dropped from any
body written as Markdown."""

from typing import Final

# Each list type and the item type it holds.
LISTS: Final[dict[str, str]] = {"bulletList": "listItem", "orderedList": "listItem", "taskList": "taskItem"}
LIST_ITEMS: Final = frozenset({"listItem", "taskItem"})
INLINE_NODES: Final = frozenset({"text", "hardBreak"})
# In the order marks nest, outermost first, so equal mark sets always compare equal.
MARKS: Final = (
    "link",
    "bold",
    "italic",
    "strike",
    "underline",
    "highlight",
    "textStyle",
    "subscript",
    "superscript",
    "code",
)
ALIGNMENTS: Final = ("left", "center", "right", "justify")
HEADING_LEVEL_MIN: Final = 1
HEADING_LEVEL_MAX: Final = 6
# The editor's link defaults.
LINK_TARGET: Final = "_blank"
LINK_REL: Final = "noopener noreferrer nofollow"
