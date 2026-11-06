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

#[Name('set_note_starred')]
#[Description('Star or unstar a note.')]
#[IsDestructive(false)]
#[IsIdempotent]
#[IsOpenWorld(false)]
class SetNoteStarredTool extends NotesTool
{
    protected string $ability = TokenAbilities::WRITE;

    public function schema(JsonSchema $schema): array
    {
        return [
            'uuid' => $schema->string()->description('The note uuid.')->required(),
            'starred' => $schema->boolean()->description('true to star, false to unstar.')->required(),
        ];
    }

    public function run(Request $request, User $user, UpdateNote $updateNote): Response
    {
        $data = $request->validate([
            'uuid' => ['required', 'uuid'],
            'starred' => ['required', 'boolean'],
        ]);

        $note = $updateNote($user, $this->note($user, $data['uuid'], 'update'), ['is_starred' => $data['starred']]);

        return Response::json($this->presenter($user)->summary($note));
    }
}
