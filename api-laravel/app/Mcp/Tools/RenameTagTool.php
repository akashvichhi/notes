<?php

namespace App\Mcp\Tools;

use App\Models\User;
use App\Services\Tags\RenameTag;
use App\Support\TokenAbilities;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Tools\Annotations\IsDestructive;
use Laravel\Mcp\Server\Tools\Annotations\IsIdempotent;
use Laravel\Mcp\Server\Tools\Annotations\IsOpenWorld;

#[Name('rename_tag')]
#[Description('Rename a tag everywhere it is used.')]
#[IsDestructive(false)]
#[IsIdempotent]
#[IsOpenWorld(false)]
class RenameTagTool extends NotesTool
{
    protected string $ability = TokenAbilities::WRITE;

    public function schema(JsonSchema $schema): array
    {
        return [
            'id' => $schema->string()->description('The tag id from list_tags.')->required(),
            'name' => $schema->string()->max(60)->description('The new name.')->required(),
        ];
    }

    public function run(Request $request, User $user, RenameTag $renameTag): Response
    {
        $tag = $this->tag($user, (string) $request->validate(['id' => ['required', 'uuid']])['id']);

        // UpdateTagRequest's rule.
        $data = $request->validate([
            'name' => [
                'required', 'string', 'max:60',
                Rule::unique('tags', 'slug')
                    ->where('user_id', $user->id)
                    ->where('slug', Str::slug((string) $request->get('name')))
                    ->ignore($tag->id),
            ],
        ]);

        $tag = $renameTag($tag, $data['name']);

        return Response::json(['id' => $tag->uuid, 'name' => $tag->name, 'slug' => $tag->slug]);
    }
}
