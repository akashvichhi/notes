<?php

namespace App\Mcp\Tools;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Tools\Annotations\IsDestructive;
use Laravel\Mcp\Server\Tools\Annotations\IsOpenWorld;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[Name('list_tags')]
#[Description('All tags, with id, name, slug and the number of notes that carry each.')]
#[IsReadOnly]
#[IsDestructive(false)]
#[IsOpenWorld(false)]
class ListTagsTool extends NotesTool
{
    public function run(Request $request, User $user): Response
    {
        $tags = $user->tags()->orderBy('name')->get();

        // Same grouped count as the bootstrap payload: trashed notes do not count.
        $counts = DB::table('note_tag')
            ->join('notes', 'notes.id', '=', 'note_tag.note_id')
            ->selectRaw('note_tag.tag_id, COUNT(*) as aggregate')
            ->where('notes.user_id', $user->id)->whereNull('notes.deleted_at')
            ->groupBy('note_tag.tag_id')->pluck('aggregate', 'tag_id');

        return Response::json([
            'tags' => $tags->map(fn ($tag) => [
                'id' => $tag->uuid,
                'name' => $tag->name,
                'slug' => $tag->slug,
                'note_count' => (int) ($counts[$tag->id] ?? 0),
            ])->values(),
        ]);
    }
}
