<?php

namespace App\Mcp\Tools;

use Illuminate\Support\Str;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Tools\Annotations\IsDestructive;
use Laravel\Mcp\Server\Tools\Annotations\IsIdempotent;
use Laravel\Mcp\Server\Tools\Annotations\IsOpenWorld;

#[Name('add_note_tags')]
#[Description('Add tags to a note, keeping the ones it has. Tags that do not exist yet are created.')]
#[IsDestructive(false)]
#[IsIdempotent]
#[IsOpenWorld(false)]
class AddNoteTagsTool extends NoteTagsTool
{
    protected function combine(array $current, array $given): array
    {
        $have = array_flip(array_map(fn ($n) => Str::slug($n), $current));

        return [...$current, ...array_filter($given, fn ($n) => ! isset($have[Str::slug($n)]))];
    }
}
