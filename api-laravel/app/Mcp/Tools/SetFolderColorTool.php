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

#[Name('set_folder_color')]
#[Description('Set a folder\'s colour as #rrggbb, or clear it with null.')]
#[IsDestructive(false)]
#[IsIdempotent]
#[IsOpenWorld(false)]
class SetFolderColorTool extends NotesTool
{
    protected string $ability = TokenAbilities::WRITE;

    public function schema(JsonSchema $schema): array
    {
        return [
            'id' => $schema->string()->description('The folder id from list_folders.')->required(),
            'color' => $schema->string()->nullable()->pattern('^#[0-9a-fA-F]{6}$')->description('Colour as #rrggbb, or null for none.')->required(),
        ];
    }

    public function run(Request $request, User $user, RenameFolder $renameFolder): Response
    {
        $data = $request->validate([
            'id' => ['required', 'uuid'],
            'color' => ['present', ...CreateFolderTool::COLOR_RULE],
        ]);

        $folder = $renameFolder($this->folder($user, $data['id']), ['color' => $data['color']]);

        return Response::json($this->presenter($user)->folder($folder));
    }
}
