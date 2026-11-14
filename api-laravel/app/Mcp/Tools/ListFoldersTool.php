<?php

namespace App\Mcp\Tools;

use App\Models\Folder;
use App\Models\Note;
use App\Models\User;
use Illuminate\Support\Collection;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Tools\Annotations\IsDestructive;
use Laravel\Mcp\Server\Tools\Annotations\IsOpenWorld;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[Name('list_folders')]
#[Description('The folder tree: each folder with its id, name, colour, position among its siblings, the number of notes directly in it, and its child folders.')]
#[IsReadOnly]
#[IsDestructive(false)]
#[IsOpenWorld(false)]
class ListFoldersTool extends NotesTool
{
    public function run(Request $request, User $user): Response
    {
        $folders = $user->folders()->orderBy('position')->orderBy('name')->get();

        // One grouped query, as the bootstrap payload does.
        $counts = Note::ownedBy($user)
            ->selectRaw('folder_id, COUNT(*) as aggregate')
            ->groupBy('folder_id')
            ->pluck('aggregate', 'folder_id');

        $ids = $folders->pluck('id')->flip();
        // A folder whose parent is missing is shown at the top level rather than lost.
        $children = $folders->groupBy(fn (Folder $f) => isset($ids[$f->parent_id]) ? $f->parent_id : Folder::ROOT);

        return Response::json([
            'folders' => $this->tree($children, Folder::ROOT, $counts, []),
            'notes_outside_folders' => (int) ($counts[''] ?? 0),
            'total_notes' => (int) $counts->sum(),
        ]);
    }

    private function tree(Collection $children, int $parentId, Collection $counts, array $seen): array
    {
        return ($children[$parentId] ?? collect())
            ->reject(fn (Folder $f) => isset($seen[$f->id]))
            ->map(fn (Folder $f) => [
                'id' => $f->uuid,
                'name' => $f->name,
                'color' => $f->color,
                'position' => (int) $f->position,
                'note_count' => (int) ($counts[$f->id] ?? 0),
                'children' => $this->tree($children, $f->id, $counts, $seen + [$f->id => true]),
            ])
            ->values()
            ->all();
    }
}
