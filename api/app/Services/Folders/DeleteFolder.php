<?php

namespace App\Services\Folders;

use App\Models\Folder;
use Illuminate\Support\Facades\DB;

class DeleteFolder
{
    /**
     * Notes survive and move to root; child folders are reparented. Destroying
     * notes because someone tidied their sidebar is unforgivable, so the
     * reparenting and the delete share one transaction.
     */
    public function __invoke(Folder $folder): void
    {
        DB::transaction(function () use ($folder) {
            $folder->notes()->update(['folder_id' => null]);
            Folder::where('parent_id', $folder->id)->update(['parent_id' => Folder::ROOT]);
            $folder->delete();
        });
    }
}
