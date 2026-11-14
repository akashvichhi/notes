<?php

namespace App\Http\Resources;

use App\Models\Folder;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class FolderResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'uuid' => $this->uuid,
            'name' => $this->name,
            'parent_uuid' => $this->parent_id === Folder::ROOT ? null : $this->parent?->uuid,
            'color' => $this->color,
            'position' => $this->position,
        ];
    }
}
