<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;

class NoteResource extends NoteListResource
{
    public function toArray(Request $request): array
    {
        return parent::toArray($request) + [
            'body' => $this->body,
            'version' => $this->version,
            'word_count' => $this->word_count,
            'title_locked' => $this->title_locked,
        ];
    }
}
