<?php

namespace App\Mcp\Tools;

use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Tools\Annotations\IsDestructive;
use Laravel\Mcp\Server\Tools\Annotations\IsIdempotent;
use Laravel\Mcp\Server\Tools\Annotations\IsOpenWorld;

#[Name('set_note_tags')]
#[Description('Replace a note\'s tags with exactly this list (an empty list clears them). Tags that do not exist yet are created; tags taken off the note still exist.')]
#[IsDestructive(false)]
#[IsIdempotent]
#[IsOpenWorld(false)]
class SetNoteTagsTool extends NoteTagsTool
{
    protected function combine(array $current, array $given): array
    {
        return $given;
    }
}
