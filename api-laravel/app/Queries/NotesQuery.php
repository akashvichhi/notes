<?php

namespace App\Queries;

use App\Models\Note;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class NotesQuery
{
    public function __construct(private readonly FolderQuery $folders) {}

    public function paginate(User $user, array $filters, int $perPage = 50): LengthAwarePaginator
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

        $query = match ($filters['sort'] ?? 'updated') {
            'created' => $query->orderByDesc('created_at')->orderByDesc('id'),
            'title' => $query->orderBy('title')->orderBy('id'),
            default => $query->orderByDesc('updated_at')->orderByDesc('id'),
        };

        $resolvedPerPage = (int) ($filters['per_page'] ?? $perPage);
        $resolvedPage = isset($filters['page']) ? (int) $filters['page'] : null;

        return $query->paginate(perPage: $resolvedPerPage, page: $resolvedPage);
    }
}
