<?php

namespace App\Queries;

use App\Models\Note;
use App\Models\User;
use Illuminate\Contracts\Pagination\CursorPaginator;

class NotesQuery
{
    public function __construct(private readonly FolderQuery $folders) {}

    public function paginate(User $user, array $filters, int $perPage = 50): CursorPaginator
    {
        $query = Note::ownedBy($user)->with(['folder', 'tags']);

        if ($filters['trashed'] ?? false) {
            $query->onlyTrashed();
        }

        if ($filters['folder_uuid'] ?? null) {
            $query->where('folder_id', $this->folders->idForUuid($user, $filters['folder_uuid']));
        }

        if ($filters['tag'] ?? null) {
            $query->whereHas('tags', fn ($q) => $q->where('slug', $filters['tag']));
        }

        if ($filters['starred'] ?? false) {
            $query->where('is_starred', true);
        }

        // Cursor pagination: updated_at changes constantly, so offset pagination
        // would duplicate and skip rows while the user types.
        $query = match ($filters['sort'] ?? 'updated') {
            'created' => $query->orderByDesc('created_at')->orderByDesc('id'),
            'title' => $query->orderBy('title')->orderBy('id'),
            default => $query->orderByDesc('updated_at')->orderByDesc('id'),
        };

        return $query->cursorPaginate($perPage);
    }
}
