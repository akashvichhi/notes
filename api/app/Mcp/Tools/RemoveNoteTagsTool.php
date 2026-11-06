<?php

namespace App\Mcp\Tools;

use Illuminate\Support\Str;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Tools\Annotations\IsDestructive;
use Laravel\Mcp\Server\Tools\Annotations\IsIdempotent;
use Laravel\Mcp\Server\Tools\Annotations\IsOpenWorld;

#[Name('remove_note_tags')]
#[Description('Take tags off a note. This only edits the note: the tags themselves remain and stay on other notes.')]
#[IsDestructive(false)]
#[IsIdempotent]
#[IsOpenWorld(false)]
class RemoveNoteTagsTool extends NoteTagsTool
{
    protected function combine(array $current, array $given): array
    {
        $drop = array_flip(array_map(fn ($n) => Str::slug($n), $given));

        return array_values(array_filter($current, fn ($n) => ! isset($drop[Str::slug($n)])));
    }
}
