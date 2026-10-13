<?php

namespace App\Services\Notes;

use App\Models\Note;

class DeleteNote
{
    /**
     * `$force` serves two very different UX paths: "Delete permanently" from the
     * Trash view, and the silent discard of an abandoned empty note. The server
     * behaviour is identical; only the client differs (no toast, no confirm).
     */
    public function __invoke(Note $note, bool $force = false): void
    {
        $force ? $note->forceDelete() : $note->delete();
    }
}
