<?php

namespace App\Mcp\Tools;

use App\Models\User;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Tools\Annotations\IsDestructive;
use Laravel\Mcp\Server\Tools\Annotations\IsOpenWorld;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[Name('get_note')]
#[Description('Read one note: its title, its body as markdown, folder, tags, starred flag and version. Pasted images appear as ![…](note-image:N) placeholders; keep them exactly as they are when you write the body back. Pass the version to update_note.')]
#[IsReadOnly]
#[IsDestructive(false)]
#[IsOpenWorld(false)]
class GetNoteTool extends NotesTool
{
    public function schema(JsonSchema $schema): array
    {
        return [
            'uuid' => $schema->string()->description('The note uuid.')->required(),
        ];
    }

    public function run(Request $request, User $user): Response
    {
        $uuid = $request->validate(['uuid' => ['required', 'uuid']])['uuid'];

        return Response::json($this->presenter($user)->full($this->note($user, $uuid)));
    }
}
