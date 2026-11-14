<?php

namespace App\Services\Folders;

use App\Models\Folder;
use App\Models\User;

class CreateFolder
{
    public function __invoke(User $user, string $name, int $parentId, ?string $color = null, ?string $uuid = null): Folder
    {
        $folder = $user->folders()->make([
            'name' => $name,
            'parent_id' => $parentId,
            'color' => $color,
        ]);

        if ($uuid) {
            $folder->uuid = $uuid;
        }

        $folder->save();

        return $folder;
    }
}
