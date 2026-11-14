<?php

namespace App\Mcp\Tools;

use App\Models\Note;
use App\Models\User;
use App\Queries\NotesQuery;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Support\Str;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Tools\Annotations\IsDestructive;
use Laravel\Mcp\Server\Tools\Annotations\IsOpenWorld;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[Name('list_notes')]
#[Description('List notes, optionally only those in one folder, with one tag, or starred. Paginated; returns titles and excerpts, not bodies (use get_note for a body). Notes in Trash are never listed.')]
#[IsReadOnly]
#[IsDestructive(false)]
#[IsOpenWorld(false)]
class ListNotesTool extends NotesTool
{
    public function schema(JsonSchema $schema): array
    {
        return [
            'folder_id' => $schema->string()->description('Only notes directly in this folder (a folder id from list_folders).'),
            'tag' => $schema->string()->max(60)->description('Only notes with this tag (its name or slug).'),
            'starred' => $schema->boolean()->description('true for starred notes only.'),
            'sort' => $schema->string()->enum(['updated', 'created', 'title'])->description('Order: updated (default, newest first), created (newest first) or title (A–Z).'),
            'page' => $schema->integer()->min(1)->description('Page number, from 1.'),
            'per_page' => $schema->integer()->min(1)->max(100)->description('Notes per page (default 25, at most 100).'),
        ];
    }

    public function run(Request $request, User $user, NotesQuery $notes): Response
    {
        $data = $request->validate([
            'folder_id' => ['nullable', 'uuid'],
            'tag' => ['nullable', 'string', 'max:60'],
            'starred' => ['nullable', 'boolean'],
            'sort' => ['nullable', 'in:updated,created,title'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        if (! empty($data['folder_id'])) {
            $this->folder($user, $data['folder_id']);   // a clear error for an unknown folder
        }

        $page = $notes->paginate($user, [
            'folder_uuid' => $data['folder_id'] ?? null,
            'tag' => ! empty($data['tag']) ? Str::slug($data['tag']) : null,
            'starred' => (bool) ($data['starred'] ?? false),
            'trashed' => false,
            'sort' => $data['sort'] ?? 'updated',
            'page' => (int) ($data['page'] ?? 1),
            'per_page' => (int) ($data['per_page'] ?? 25),
        ]);

        $presenter = $this->presenter($user);

        return Response::json([
            'notes' => collect($page->items())->map(fn (Note $note) => $presenter->summary($note))->values(),
            'page' => $page->currentPage(),
            'per_page' => $page->perPage(),
            'total' => $page->total(),
            'last_page' => $page->lastPage(),
        ]);
    }
}
