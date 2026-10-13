<?php

namespace App\Services\Search;

use App\Models\Note;
use App\Models\User;
use App\Support\SearchTerms;
use App\Support\SnippetBuilder;

class SearchNotes
{
    /**
     * Returns the whole grouped payload. The snippet is PLAIN TEXT and the
     * matched terms are returned beside it — the client applies the <mark>, so
     * nothing the server emits can become markup.
     */
    public function __invoke(User $user, string $q, int $limit = 20): array
    {
        $terms = SearchTerms::parse($q);

        $notes = $terms === [] ? collect() : Note::ownedBy($user)
            ->whereNull('deleted_at')
            // Boolean mode with a trailing wildcard gives search-as-you-type and
            // partly compensates for MySQL having no stemming.
            ->whereRaw(
                'MATCH(title, plain_text) AGAINST (? IN BOOLEAN MODE)',
                [SearchTerms::expression($terms)],
            )
            ->orderByDesc('updated_at')
            ->limit($limit)
            ->get()
            ->map(fn (Note $note) => [
                'uuid' => $note->uuid,
                'title' => $note->title,
                'snippet' => SnippetBuilder::build((string) $note->plain_text, $terms),
                'terms' => $terms,
            ]);

        return [
            'notes' => $notes->values(),
            'folders' => $user->folders()->where('name', 'like', $q.'%')->limit(5)->get()
                ->map(fn ($f) => ['uuid' => $f->uuid, 'name' => $f->name])->values(),
            'tags' => $user->tags()->where('name', 'like', $q.'%')->limit(5)->get()
                ->map(fn ($t) => ['uuid' => $t->uuid, 'name' => $t->name, 'slug' => $t->slug])->values(),
        ];
    }
}
