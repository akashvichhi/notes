<?php

namespace App\Services\Folders;

use App\Models\Folder;
use Illuminate\Support\Facades\DB;

class DeleteFolder
{
    /**
     * Notes survive and move to root; child folders move up one level, into
     * the deleted folder's parent. Destroying notes because someone tidied
     * their sidebar is unforgivable, so the moves and the delete share one
     * transaction.
     */
    public function __invoke(Folder $folder): void
    {
        DB::transaction(function () use ($folder) {
            $folder->notes()->update(['folder_id' => null]);
            $children = Folder::where('parent_id', $folder->id)->get();

            // Deleted first, so a child may take the folder's own name.
            $folder->delete();

            foreach ($children as $child) {
                $child->update([
                    'parent_id' => $folder->parent_id,
                    'name' => $this->freeName($folder, $child->name),
                ]);
            }
        });
    }

    /** Names are unique per parent, so a clash gets a " (2)" style suffix. */
    private function freeName(Folder $deleted, string $name): string
    {
        $taken = Folder::where('user_id', $deleted->user_id)
            ->where('parent_id', $deleted->parent_id)
            ->pluck('name')
            ->all();

        $candidate = $name;
        for ($n = 2; in_array($candidate, $taken, true); $n++) {
            $candidate = "{$name} ({$n})";
        }

        return $candidate;
    }
}
