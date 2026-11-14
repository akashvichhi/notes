<?php

namespace App\Services\Notes;

use App\Models\Note;
use App\Models\User;
use App\Queries\FolderQuery;

class CreateNote
{
    public function __construct(
        private readonly FolderQuery $folders,
        private readonly DeriveNoteFields $derive,
    ) {}

    public function __invoke(User $user, ?string $folderUuid = null, ?string $uuid = null): Note
    {
        $note = new Note([
            'folder_id' => $this->folders->idForUuid($user, $folderUuid),
            // JSON columns take no DEFAULT, so the empty document is written here.
            'body' => ['type' => 'doc', 'content' => []],
        ]);

        if ($uuid) {
            $note->uuid = $uuid;
        }

        $note->user_id = $user->id;
        ($this->derive)($note);
        $note->save();

        return $note->load(['folder', 'tags']);
    }
}
