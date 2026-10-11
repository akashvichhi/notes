<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class NoteListResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'uuid' => $this->uuid,
            'title' => $this->title,
            'excerpt' => $this->excerpt,
            'is_starred' => $this->is_starred,
            'folder' => $this->whenLoaded('folder', fn () => $this->folder ? [
                'uuid' => $this->folder->uuid,
                'name' => $this->folder->name,
            ] : null),
            'tags' => $this->whenLoaded('tags', fn () => $this->tags->pluck('slug')),
            'updated_at' => $this->updated_at?->toIso8601String(),
            'deleted_at' => $this->deleted_at?->toIso8601String(),
        ];
    }
}
