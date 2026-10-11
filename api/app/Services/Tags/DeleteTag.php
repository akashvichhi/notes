<?php

namespace App\Services\Tags;

use App\Models\Tag;

class DeleteTag
{
    /** Detaching happens through the pivot's cascade. Notes are untouched. */
    public function __invoke(Tag $tag): void
    {
        $tag->delete();
    }
}
