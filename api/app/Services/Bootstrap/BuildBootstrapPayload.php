<?php

namespace App\Services\Bootstrap;

use App\Http\Resources\FolderResource;
use App\Http\Resources\NoteListResource;
use App\Http\Resources\TagResource;
use App\Http\Resources\UserResource;
use App\Models\Note;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class BuildBootstrapPayload
{
    public function __invoke(User $user): array
    {
        $folders = $user->folders()->orderBy('position')->orderBy('name')->get();
        $tags = $user->tags()->orderBy('name')->get();

        // Two grouped queries, not one per folder.
        $byFolder = DB::table('notes')
            ->selectRaw('folder_id, COUNT(*) as aggregate')
            ->where('user_id', $user->id)->whereNull('deleted_at')
            ->groupBy('folder_id')->pluck('aggregate', 'folder_id');

        $byTag = DB::table('note_tag')
            ->join('notes', 'notes.id', '=', 'note_tag.note_id')
            ->selectRaw('note_tag.tag_id, COUNT(*) as aggregate')
            ->where('notes.user_id', $user->id)->whereNull('notes.deleted_at')
            ->groupBy('note_tag.tag_id')->pluck('aggregate', 'tag_id');

        $notes = Note::ownedBy($user)->with(['folder', 'tags'])
            ->orderByDesc('updated_at')->orderByDesc('id')
            ->limit(50)->get();

        return [
            'user' => new UserResource($user),
            'folders' => FolderResource::collection($folders),
            'tags' => TagResource::collection($tags),
            'counts' => [
                'all' => (int) $byFolder->sum(),
                'starred' => Note::ownedBy($user)->where('is_starred', true)->count(),
                'trashed' => Note::ownedBy($user)->onlyTrashed()->count(),
                'folders' => (object) $folders->mapWithKeys(
                    fn ($f) => [$f->uuid => (int) ($byFolder[$f->id] ?? 0)]
                )->all(),
                'tags' => (object) $tags->mapWithKeys(
                    fn ($t) => [$t->slug => (int) ($byTag[$t->id] ?? 0)]
                )->all(),
            ],
            'notes' => NoteListResource::collection($notes),
        ];
    }
}
