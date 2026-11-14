<?php

namespace App\Mcp\Tools;

use App\Models\User;
use App\Services\Folders\RenameFolder;
use App\Support\TokenAbilities;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Validation\Rule;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Tools\Annotations\IsDestructive;
use Laravel\Mcp\Server\Tools\Annotations\IsIdempotent;
use Laravel\Mcp\Server\Tools\Annotations\IsOpenWorld;

#[Name('rename_folder')]
#[Description('Rename a folder. Names must be unique among siblings.')]
#[IsDestructive(false)]
#[IsIdempotent]
#[IsOpenWorld(false)]
class RenameFolderTool extends NotesTool
{
    protected string $ability = TokenAbilities::WRITE;

    public function schema(JsonSchema $schema): array
    {
        return [
            'id' => $schema->string()->description('The folder id from list_folders.')->required(),
            'name' => $schema->string()->max(120)->description('The new name.')->required(),
        ];
    }

    public function run(Request $request, User $user, RenameFolder $renameFolder): Response
    {
        $folder = $this->folder($user, (string) $request->validate(['id' => ['required', 'uuid']])['id']);

        // UpdateFolderRequest's rule.
        $data = $request->validate([
            'name' => [
                'required', 'string', 'max:120',
                Rule::unique('folders', 'name')
                    ->where('user_id', $user->id)
                    ->where('parent_id', $folder->parent_id)
                    ->ignore($folder->id),
            ],
        ]);

        return Response::json($this->presenter($user)->folder($renameFolder($folder, ['name' => $data['name']])));
    }
}
