<?php

namespace App\Services\Folders;

use App\Models\Folder;

class RenameFolder
{
    public function __invoke(Folder $folder, array $attributes): Folder
    {
        $folder->update($attributes);

        return $folder->fresh();
    }
}
