<?php

namespace App\Mcp\Tools;

use App\Models\User;
use App\Services\Notes\DuplicateNote;
use App\Support\TokenAbilities;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Tools\Annotations\IsDestructive;
use Laravel\Mcp\Server\Tools\Annotations\IsOpenWorld;

#[Name('duplicate_note')]
#[Description('Copy a note (body, folder and tags) into a new note titled "<title> (copy)". Returns the copy.')]
#[IsDestructive(false)]
#[IsOpenWorld(false)]
class DuplicateNoteTool extends NotesTool
{
    protected string $ability = TokenAbilities::WRITE;

    public function schema(JsonSchema $schema): array
    {
        return [
            'uuid' => $schema->string()->description('The uuid of the note to copy.')->required(),
        ];
    }

    public function run(Request $request, User $user, DuplicateNote $duplicateNote): Response
    {
        $uuid = $request->validate(['uuid' => ['required', 'uuid']])['uuid'];

        // Same policy as POST /notes/{note}/duplicate.
        $copy = $duplicateNote($this->note($user, $uuid, 'view', write: true));

        return Response::json($this->presenter($user)->summary($copy) + ['version' => (int) $copy->version]);
    }
}
