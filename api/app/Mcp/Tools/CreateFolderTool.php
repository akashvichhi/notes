<?php

namespace App\Mcp\Tools;

use App\Models\Folder;
use App\Models\User;
use App\Services\Folders\CreateFolder;
use App\Support\TokenAbilities;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Tools\Annotations\IsDestructive;
use Laravel\Mcp\Server\Tools\Annotations\IsOpenWorld;

#[Name('create_folder')]
#[Description('Create a folder, at the top level or inside another folder. Names must be unique among siblings.')]
#[IsDestructive(false)]
#[IsOpenWorld(false)]
class CreateFolderTool extends NotesTool
{
    public const COLOR_RULE = ['nullable', 'string', 'size:7', 'regex:/^#[0-9a-fA-F]{6}$/'];

    protected string $ability = TokenAbilities::WRITE;

    public function schema(JsonSchema $schema): array
    {
        return [
            'name' => $schema->string()->max(120)->description('The folder name.')->required(),
            'parent_id' => $schema->string()->description('Parent folder id from list_folders. Omit for a top-level folder.'),
            'color' => $schema->string()->pattern('^#[0-9a-fA-F]{6}$')->description('Colour as #rrggbb.'),
        ];
    }

    public function run(Request $request, User $user, CreateFolder $createFolder): Response
    {
        $parentUuid = $request->get('parent_id');
        $parentId = is_string($parentUuid) && Str::isUuid($parentUuid)
            ? $this->folder($user, $parentUuid)->id
            : Folder::ROOT;

        // StoreFolderRequest's rules.
        $data = $request->validate([
            'name' => [
                'required', 'string', 'max:120',
                Rule::unique('folders', 'name')->where('user_id', $user->id)->where('parent_id', $parentId),
            ],
            'parent_id' => ['nullable', 'uuid'],
            'color' => self::COLOR_RULE,
        ]);

        $folder = $createFolder($user, $data['name'], $parentId, $data['color'] ?? null, (string) Str::uuid7());

        return Response::json($this->presenter($user)->folder($folder));
    }
}
