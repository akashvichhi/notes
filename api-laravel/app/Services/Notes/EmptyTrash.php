<?php

namespace App\Services\Notes;

use App\Models\Note;
use App\Models\User;

class EmptyTrash
{
    public function __invoke(User $user): void
    {
        Note::ownedBy($user)->onlyTrashed()->forceDelete();
    }
}
