<?php

namespace App\Services\Notes;

use App\Exceptions\NoteConflictException;
use App\Models\Note;
use App\Models\User;
use App\Queries\FolderQuery;
use Illuminate\Support\Facades\DB;

class UpdateNote
{
    public function __construct(
        private readonly FolderQuery $folders,
        private readonly DeriveNoteFields $derive,
    ) {}

    /**
     * @param  array  $changes  Any of body+version, title, folder_id, is_starred.
     *
     * @throws NoteConflictException when a body write carries a stale version,
     *                               or targets a trashed note (SPEC 5.5).
     */
    public function __invoke(User $user, Note $note, array $changes): Note
    {
        return DB::transaction(function () use ($user, $note, $changes) {
            if (array_key_exists('body', $changes)) {
                $this->applyBody($note, $changes['body'], (int) $changes['version']);
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
        });
    }

    /**
     * Optimistic concurrency applies to document writes ONLY: metadata changes
     * must never conflict with an in-flight autosave. The version is read under
     * a row lock, so two writes carrying the same version cannot both pass.
     */
    private function applyBody(Note $note, array $body, int $version): void
    {
        $current = Note::withTrashed()->whereKey($note->getKey())->lockForUpdate()->firstOrFail();

        if ($current->trashed() || $version !== (int) $current->version) {
            throw new NoteConflictException($current);
        }

        $note->body = $body;
        ($this->derive)($note);
        $note->version = $current->version + 1;
    }
}
