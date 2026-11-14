<?php

namespace App\Support\Content;

use Tiptap\Extensions\Color;
use Tiptap\Extensions\StarterKit;
use Tiptap\Extensions\TextAlign;
use Tiptap\Marks\Highlight;
use Tiptap\Marks\Link;
use Tiptap\Marks\Subscript;
use Tiptap\Marks\Superscript;
use Tiptap\Marks\TextStyle;
use Tiptap\Marks\Underline;
use Tiptap\Nodes\Details;
use Tiptap\Nodes\DetailsContent;
use Tiptap\Nodes\DetailsSummary;
use Tiptap\Nodes\Image;
use Tiptap\Nodes\Table;
use Tiptap\Nodes\TableCell;
use Tiptap\Nodes\TableHeader;
use Tiptap\Nodes\TableRow;
use Tiptap\Nodes\TaskItem;
use Tiptap\Nodes\TaskList;

/**
 * The node and mark set of web/src/components/editor/extensions.ts, for
 * tiptap-php. Keep the two in step: a node missing here is dropped from any
 * body written through the MCP.
 */
class EditorSchema
{
    /** Node names, as the editor's ProseMirror JSON spells them. */
    public const BLOCK_CONTAINERS = ['doc', 'blockquote', 'listItem', 'taskItem', 'tableCell', 'tableHeader', 'detailsContent'];

    public const INLINE_CONTAINERS = ['paragraph', 'heading', 'detailsSummary'];

    public const LISTS = ['bulletList' => 'listItem', 'orderedList' => 'listItem', 'taskList' => 'taskItem'];

    public const INLINE_NODES = ['text', 'hardBreak'];

    public const MARKS = ['link', 'bold', 'italic', 'strike', 'underline', 'highlight', 'textStyle', 'subscript', 'superscript', 'code'];

    public const ALIGNMENTS = ['left', 'center', 'right', 'justify'];

    /** The editor's Link defaults (Mantine's Link extends Tiptap's). */
    public const LINK_TARGET = '_blank';

    public const LINK_REL = 'noopener noreferrer nofollow';

    public static function extensions(): array
    {
        return [
            new StarterKit,
            new Underline,
            new Link,
            new Highlight,
            new TextStyle,
            new Color,
            new Subscript,
            new Superscript,
            // The editor's default alignment is null, not 'left'.
            new TextAlign(['types' => ['heading', 'paragraph'], 'defaultAlignment' => null]),
            new TaskList,
            new TaskItem,
            new Table,
            new TableRow,
            new TableHeader,
            new TableCell,
            new Image,
            new Details,
            new DetailsSummary,
            new DetailsContent,
        ];
    }
}
