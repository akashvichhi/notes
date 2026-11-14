<?php

namespace App\Mcp\Tools;

use App\Models\User;
use App\Services\Tags\CreateTag;
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

#[Name('create_tag')]
#[Description('Create a tag without putting it on a note. (create_note, set_note_tags and add_note_tags create missing tags on their own.)')]
#[IsDestructive(false)]
#[IsOpenWorld(false)]
class CreateTagTool extends NotesTool
{
    protected string $ability = TokenAbilities::WRITE;

    public function schema(JsonSchema $schema): array
    {
        return [
            'name' => $schema->string()->max(60)->description('The tag name.')->required(),
        ];
    }

    public function run(Request $request, User $user, CreateTag $createTag): Response
    {
        // StoreTagRequest's rule.
        $data = $request->validate([
            'name' => [
                'required', 'string', 'max:60',
                Rule::unique('tags', 'slug')
                    ->where('user_id', $user->id)
                    ->where('slug', Str::slug((string) $request->get('name'))),
            ],
        ]);

        $tag = $createTag($user, $data['name'], (string) Str::uuid7());

        return Response::json(['id' => $tag->uuid, 'name' => $tag->name, 'slug' => $tag->slug]);
    }
}
