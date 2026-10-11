<?php

namespace App\Services\Folders;

use App\Models\Folder;
use App\Models\User;

class CreateFolder
{
    public function __invoke(User $user, string $name, int $parentId, ?string $color = null): Folder
    {
        return $user->folders()->create([
            'name' => $name,
            'parent_id' => $parentId,
            'color' => $color,
        ]);
    }
}
