<?php

namespace App\Services\Notes;

use App\Models\Note;
use Illuminate\Support\Facades\DB;

class DuplicateNote
{
    public function __invoke(Note $note): Note
    {
        return DB::transaction(function () use ($note) {
            $copy = $note->replicate(['uuid', 'version', 'deleted_at', 'created_at', 'updated_at']);
            $copy->version = 1;
            $copy->title = $note->title === '' ? '' : $note->title.' (copy)';
            // A copy keeps its name: it must not be renamed by body derivation.
            $copy->title_locked = $note->title !== '';
            $copy->save();
            $copy->tags()->sync($note->tags->pluck('id'));

            return $copy->fresh()->load(['folder', 'tags']);
        });
    }
}
