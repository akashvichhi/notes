<?php

namespace App\Services\Notes;

use App\Models\Note;
use App\Models\User;
use App\Services\Tags\UpsertTags;

class SyncNoteTags
{
    public function __construct(private readonly UpsertTags $upsertTags) {}

    /** Replaces the whole set, creating any tag names that do not exist yet. */
    public function __invoke(User $user, Note $note, array $names): Note
    {
        $tags = ($this->upsertTags)($user, $names);
        $note->tags()->sync($tags->pluck('id'));

        return $note->fresh()->load(['folder', 'tags']);
    }
}
