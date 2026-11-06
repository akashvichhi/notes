<?php

namespace App\Mcp\Tools;

use App\Models\User;
use App\Services\Notes\UpdateNote;
use App\Support\TokenAbilities;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Tools\Annotations\IsDestructive;
use Laravel\Mcp\Server\Tools\Annotations\IsIdempotent;
use Laravel\Mcp\Server\Tools\Annotations\IsOpenWorld;

#[Name('move_note')]
#[Description('Move a note into a folder, or out of every folder with folder_id null.')]
#[IsDestructive(false)]
#[IsIdempotent]
#[IsOpenWorld(false)]
class MoveNoteTool extends NotesTool
{
    protected string $ability = TokenAbilities::WRITE;

    public function schema(JsonSchema $schema): array
    {
        return [
            'uuid' => $schema->string()->description('The note uuid.')->required(),
            'folder_id' => $schema->string()->nullable()->description('The destination folder id from list_folders, or null for no folder.')->required(),
        ];
    }

    public function run(Request $request, User $user, UpdateNote $updateNote): Response
    {
        $data = $request->validate([
            'uuid' => ['required', 'uuid'],
            'folder_id' => ['present', 'nullable', 'uuid'],
        ]);

        $note = $this->note($user, $data['uuid'], 'update');

        if ($data['folder_id'] !== null) {
            $this->folder($user, $data['folder_id']);
        }

        $note = $updateNote($user, $note, ['folder_id' => $data['folder_id']]);

        return Response::json($this->presenter($user)->summary($note));
    }
}
