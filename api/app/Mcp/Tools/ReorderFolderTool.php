<?php

namespace App\Mcp\Tools;

use App\Models\User;
use App\Services\Folders\RenameFolder;
use App\Support\TokenAbilities;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Tools\Annotations\IsDestructive;
use Laravel\Mcp\Server\Tools\Annotations\IsIdempotent;
use Laravel\Mcp\Server\Tools\Annotations\IsOpenWorld;

#[Name('reorder_folder')]
#[Description('Set a folder\'s position among its siblings. Folders are shown in ascending position, then by name; list_folders shows the current positions.')]
#[IsDestructive(false)]
#[IsIdempotent]
#[IsOpenWorld(false)]
class ReorderFolderTool extends NotesTool
{
    protected string $ability = TokenAbilities::WRITE;

    public function schema(JsonSchema $schema): array
    {
        return [
            'id' => $schema->string()->description('The folder id from list_folders.')->required(),
            'position' => $schema->integer()->min(0)->description('The new position.')->required(),
        ];
    }

    public function run(Request $request, User $user, RenameFolder $renameFolder): Response
    {
        $data = $request->validate([
            'id' => ['required', 'uuid'],
            'position' => ['required', 'integer', 'min:0'],
        ]);

        $folder = $renameFolder($this->folder($user, $data['id']), ['position' => (int) $data['position']]);

        return Response::json($this->presenter($user)->folder($folder));
    }
}
