<?php

namespace App\Services\Notes;

use App\Models\Note;
use App\Models\User;
use App\Queries\FolderQuery;

class RestoreNote
{
    public function __construct(private readonly FolderQuery $folders) {}

    public function __invoke(User $user, Note $note, ?string $folderUuid = null): Note
    {
        if ($folderUuid) {
            $note->folder_id = $this->folders->idForUuid($user, $folderUuid);
        }

        $note->restore();

        return $note->fresh()->load(['folder', 'tags']);
    }
}
