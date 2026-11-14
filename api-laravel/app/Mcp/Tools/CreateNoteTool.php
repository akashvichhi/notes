<?php

namespace App\Mcp\Tools;

use App\Models\User;
use App\Services\Notes\CreateNote;
use App\Services\Notes\SyncNoteTags;
use App\Services\Notes\UpdateNote;
use App\Support\Content\MarkdownToProseMirror;
use App\Support\TokenAbilities;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Tools\Annotations\IsDestructive;
use Laravel\Mcp\Server\Tools\Annotations\IsOpenWorld;

#[Name('create_note')]
#[Description('Create a note with a title and optional markdown body, folder and tags. Tags that do not exist yet are created. Returns the new note.')]
#[IsDestructive(false)]
#[IsOpenWorld(false)]
class CreateNoteTool extends NotesTool
{
    protected string $ability = TokenAbilities::WRITE;

    public function schema(JsonSchema $schema): array
    {
        return [
            'title' => $schema->string()->max(255)->description('The note title.')->required(),
            'markdown' => $schema->string()->description('The body, as markdown (see the server instructions for underline, colour, alignment and so on).'),
            'folder_id' => $schema->string()->description('Folder to create it in (an id from list_folders). Omit for no folder.'),
            'tags' => $schema->array()->items($schema->string())->max(50)->description('Tag names.'),
        ];
    }

    public function run(Request $request, User $user, CreateNote $createNote, UpdateNote $updateNote, SyncNoteTags $syncTags): Response
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'markdown' => ['nullable', 'string'],
            'folder_id' => ['nullable', 'uuid'],
            'tags' => ['nullable', 'array', 'max:50'],
            'tags.*' => ['string', 'max:60'],
        ]);

        if (! empty($data['folder_id'])) {
            $this->folder($user, $data['folder_id']);
        }

        // Convert before writing anything, so bad markdown leaves no empty note behind.
        $body = isset($data['markdown']) && trim($data['markdown']) !== ''
            ? $this->checkBody(MarkdownToProseMirror::convert($data['markdown']))
            : null;

        $note = DB::transaction(function () use ($user, $data, $body, $createNote, $updateNote, $syncTags) {
            $note = $createNote($user, $data['folder_id'] ?? null, (string) Str::uuid7())->fresh();

            $changes = ['title' => $data['title']];
            if ($body !== null) {
                $changes += ['body' => $body, 'version' => $note->version];
            }
            $note = $updateNote($user, $note, $changes);

            $tags = $this->tagNames($data['tags'] ?? []);

            return $tags === [] ? $note : $syncTags($user, $note, $tags);
        });

        return Response::json($this->presenter($user)->summary($note) + ['version' => (int) $note->version]);
    }
}
