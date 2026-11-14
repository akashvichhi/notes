<?php

namespace App\Mcp\Tools;

use App\Mcp\ToolFailure;
use App\Models\User;
use App\Services\Notes\SyncNoteTags;
use App\Support\TokenAbilities;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;

/**
 * set/add/remove_note_tags: each computes the note's new tag list and hands it
 * to SyncNoteTags. Removing a tag from a note never deletes the tag itself.
 */
abstract class NoteTagsTool extends NotesTool
{
    /** The same cap as PUT /notes/{note}/tags. */
    private const MAX_TAGS = 50;

    protected string $ability = TokenAbilities::WRITE;

    /**
     * @param  string[]  $current  the note's tag names now
     * @param  string[]  $given  the names passed to the tool
     * @return string[]
     */
    abstract protected function combine(array $current, array $given): array;

    public function schema(JsonSchema $schema): array
    {
        return [
            'uuid' => $schema->string()->description('The note uuid.')->required(),
            'tags' => $schema->array()->items($schema->string()->max(60))->max(self::MAX_TAGS)->description('Tag names.')->required(),
        ];
    }

    public function run(Request $request, User $user, SyncNoteTags $syncTags): Response
    {
        $data = $request->validate([
            'uuid' => ['required', 'uuid'],
            'tags' => ['present', 'array', 'max:'.self::MAX_TAGS],
            'tags.*' => ['string', 'max:60'],
        ]);

        $note = $this->note($user, $data['uuid'], 'update');
        $names = $this->combine($note->tags->pluck('name')->all(), $this->tagNames($data['tags']));

        if (count($names) > self::MAX_TAGS) {
            throw new ToolFailure('A note can have at most '.self::MAX_TAGS.' tags.');
        }

        $note = $syncTags($user, $note, $names);

        return Response::json($this->presenter($user)->summary($note));
    }
}
