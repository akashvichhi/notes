<?php

namespace App\Queries;

use App\Models\Folder;
use App\Models\User;

class FolderQuery
{
    /** Resolve a folder UUID to its id, scoped to the owner. */
    public function idForUuid(User $user, ?string $uuid): ?int
    {
        if (! $uuid) {
            return null;
        }

        return (int) Folder::where('user_id', $user->id)
            ->where('uuid', $uuid)
            ->valueOrFail('id');
    }

    /** Same, but falls back to the root sentinel rather than null. */
    public function parentIdForUuid(User $user, ?string $uuid): int
    {
        return $this->idForUuid($user, $uuid) ?? Folder::ROOT;
    }
}
