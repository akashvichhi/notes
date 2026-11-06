<?php

namespace App\Mcp\Servers;

use App\Mcp\Tools\AddNoteTagsTool;
use App\Mcp\Tools\CreateFolderTool;
use App\Mcp\Tools\CreateNoteTool;
use App\Mcp\Tools\CreateTagTool;
use App\Mcp\Tools\DuplicateNoteTool;
use App\Mcp\Tools\GetNoteTool;
use App\Mcp\Tools\ListFoldersTool;
use App\Mcp\Tools\ListNotesTool;
use App\Mcp\Tools\ListTagsTool;
use App\Mcp\Tools\MoveNoteTool;
use App\Mcp\Tools\RemoveNoteTagsTool;
use App\Mcp\Tools\RenameFolderTool;
use App\Mcp\Tools\RenameTagTool;
use App\Mcp\Tools\ReorderFolderTool;
use App\Mcp\Tools\SearchNotesTool;
use App\Mcp\Tools\SetFolderColorTool;
use App\Mcp\Tools\SetNoteStarredTool;
use App\Mcp\Tools\SetNoteTagsTool;
use App\Mcp\Tools\UpdateNoteTool;
use Laravel\Mcp\Server;
use Laravel\Mcp\Server\Attributes\Instructions;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Attributes\Version;

#[Name('notes')]
#[Version('1.0.0')]
#[Instructions(<<<'MARKDOWN'
    Read and write the user's notes.

    - Note bodies are markdown. Formatting markdown cannot express round-trips as inline
      HTML (<u>, <mark>, <sub>, <sup>, <span style="color:#hex">, <p align="center">,
      <details><summary>); keep those tags intact when editing.
    - Images appear as placeholders like ![image 1](note-image:1). Leave them exactly as they
      are to keep the image; remove one to remove that image. Never invent new placeholders.
    - Only the user's Cloud notes are reachable. Notes stored "On This Device" never reach the
      server, and notes in the Trash are invisible.
    - Nothing can be deleted: there is no tool to delete, trash or restore notes, folders or
      tags. If the user asks for that, tell them to do it in the Notes app.
    - Always call get_note immediately before update_note and pass the version it returned.
      If update_note reports a version conflict, call get_note again and reapply the change.
      To add to a note without rewriting it, use update_note with mode append or prepend.
    - Folders and tags are referred to by id (a uuid); use list_folders and list_tags to find
      them. Tags on notes are given by name, and missing tags are created.
    MARKDOWN)]
class NotesServer extends Server
{
    protected array $tools = [
        // Read (notes:read)
        SearchNotesTool::class,
        ListNotesTool::class,
        GetNoteTool::class,
        ListFoldersTool::class,
        ListTagsTool::class,
        // Write (notes:write). No delete, trash or restore tools, by design.
        CreateNoteTool::class,
        UpdateNoteTool::class,
        MoveNoteTool::class,
        SetNoteStarredTool::class,
        DuplicateNoteTool::class,
        SetNoteTagsTool::class,
        AddNoteTagsTool::class,
        RemoveNoteTagsTool::class,
        CreateFolderTool::class,
        RenameFolderTool::class,
        SetFolderColorTool::class,
        ReorderFolderTool::class,
        CreateTagTool::class,
        RenameTagTool::class,
    ];

    protected array $resources = [
        //
    ];

    protected array $prompts = [
        //
    ];
}
