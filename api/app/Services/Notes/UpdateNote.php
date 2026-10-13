<?php

namespace App\Services\Notes;

use App\Exceptions\NoteConflictException;
use App\Models\Note;
use App\Models\User;
use App\Queries\FolderQuery;

class UpdateNote
{
    public function __construct(
        private readonly FolderQuery $folders,
        private readonly DeriveNoteFields $derive,
    ) {}

    /**
     * @param  array  $changes  Any of body+version, title, folder_id, is_starred.
     *
     * @throws NoteConflictException when a body write carries a stale version.
     */
    public function __invoke(User $user, Note $note, array $changes): Note
    {
        if (array_key_exists('body', $changes)) {
            // Optimistic concurrency applies to document writes ONLY. Metadata
            // changes must never conflict with an in-flight autosave.
            if ((int) $changes['version'] !== (int) $note->version) {
                throw new NoteConflictException($note);
            }

            $note->body = $changes['body'];
            ($this->derive)($note);
            $note->version = $note->version + 1;
        }

        if (array_key_exists('title', $changes)) {
            $note->title = $changes['title'];
            $note->title_locked = true;   // an explicit rename wins forever
        }

        if (array_key_exists('folder_id', $changes)) {
            $note->folder_id = $this->folders->idForUuid($user, $changes['folder_id']);
        }

        if (array_key_exists('is_starred', $changes)) {
            $note->is_starred = (bool) $changes['is_starred'];
        }

        $note->save();

        return $note->fresh()->load(['folder', 'tags']);
    }
}
