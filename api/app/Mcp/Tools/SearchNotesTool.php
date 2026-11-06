<?php

namespace App\Mcp\Tools;

use App\Models\Note;
use App\Models\User;
use App\Services\Search\SearchNotes;
use App\Support\SearchTerms;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Tools\Annotations\IsDestructive;
use Laravel\Mcp\Server\Tools\Annotations\IsOpenWorld;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[Name('search_notes')]
#[Description('Full-text search of note titles and bodies. Returns up to 20 matching notes, most recently updated first, each with an excerpt around the match. Words of fewer than 3 characters are ignored.')]
#[IsReadOnly]
#[IsDestructive(false)]
#[IsOpenWorld(false)]
class SearchNotesTool extends NotesTool
{
    public function schema(JsonSchema $schema): array
    {
        return [
            'query' => $schema->string()->min(SearchTerms::MIN_TOKEN)->max(120)
                ->description('The words to search for.')->required(),
        ];
    }

    public function run(Request $request, User $user, SearchNotes $searchNotes): Response
    {
        $query = $request->validate([
            'query' => ['required', 'string', 'min:'.SearchTerms::MIN_TOKEN, 'max:120'],
        ])['query'];

        $hits = collect($searchNotes($user, $query)['notes']);
        $notes = Note::ownedBy($user)->with(['folder', 'tags'])
            ->whereIn('uuid', $hits->pluck('uuid'))->get()->keyBy('uuid');
        $presenter = $this->presenter($user);

        $results = $hits
            ->filter(fn (array $hit) => isset($notes[$hit['uuid']]))
            ->map(fn (array $hit) => ['excerpt' => $hit['snippet']] + $presenter->summary($notes[$hit['uuid']]))
            ->values();

        return Response::json(['query' => $query, 'count' => $results->count(), 'notes' => $results]);
    }
}
