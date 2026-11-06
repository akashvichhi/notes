<?php

namespace App\Mcp;

use App\Models\Folder;
use App\Models\Note;
use App\Models\User;
use App\Support\Content\ProseMirrorToMarkdown;
use Illuminate\Support\Collection;

/**
 * The shapes the MCP tools return. Notes, folders and tags are referred to by
 * uuid; a folder is also shown as its full path, e.g. "Work / Projects".
 */
class NotePresenter
{
    /** @var Collection<int, Folder>|null keyed by id */
    private ?Collection $folders = null;

    public function __construct(private readonly User $user) {}

    public function summary(Note $note): array
    {
        $note->loadMissing(['folder', 'tags']);

        return [
            'uuid' => $note->uuid,
            'title' => $note->title,
            'folder_id' => $note->folder?->uuid,
            'folder' => $this->path($note->folder_id),
            'tags' => $note->tags->pluck('name')->values()->all(),
            'starred' => (bool) $note->is_starred,
            'excerpt' => $note->excerpt,
            'updated_at' => $note->updated_at?->toIso8601String(),
        ];
    }

    public function full(Note $note): array
    {
        $summary = $this->summary($note);
        unset($summary['excerpt']);

        return $summary + [
            // Pass this back to update_note; a mismatch means the note changed meanwhile.
            'version' => (int) $note->version,
            'created_at' => $note->created_at?->toIso8601String(),
            'word_count' => (int) $note->word_count,
            'markdown' => ProseMirrorToMarkdown::convert($note->body),
        ];
    }

    public function folder(Folder $folder): array
    {
        return [
            'id' => $folder->uuid,
            'name' => $folder->name,
            'path' => $this->path($folder->id),
            'color' => $folder->color,
            'position' => (int) $folder->position,
        ];
    }

    /** "Parent / Child", or null for a note outside any folder. */
    public function path(?int $folderId): ?string
    {
        if ($folderId === null) {
            return null;
        }

        if ($this->folders === null) {
            $this->folders = $this->user->folders()->get(['id', 'parent_id', 'name'])->keyBy('id');
        }

        $names = [];
        $seen = [];

        while ($folderId !== null && $folderId !== Folder::ROOT && isset($this->folders[$folderId]) && ! isset($seen[$folderId])) {
            $seen[$folderId] = true;
            array_unshift($names, $this->folders[$folderId]->name);
            $folderId = $this->folders[$folderId]->parent_id;
        }

        return $names === [] ? null : implode(' / ', $names);
    }
}
