<?php

namespace App\Services\Notes;

use App\Models\Note;
use App\Support\PlainTextExtractor;
use Illuminate\Support\Str;

class DeriveNoteFields
{
    /**
     * Recompute every derived column from the body. Called on every write that
     * touches `body`. The client never supplies these values, or search would
     * drift from content.
     */
    public function __invoke(Note $note): void
    {
        $text = PlainTextExtractor::extract($note->body);

        $note->plain_text = $text;
        $note->excerpt = Str::limit($text, 140, '');
        $note->word_count = $text === '' ? 0 : count(preg_split('/\s+/u', $text));

        if (! $note->title_locked) {
            $note->title = PlainTextExtractor::title($note->body);
        }
    }
}
