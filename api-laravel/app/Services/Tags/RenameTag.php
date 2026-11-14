<?php

namespace App\Services\Tags;

use App\Models\Tag;
use Illuminate\Support\Str;

class RenameTag
{
    public function __invoke(Tag $tag, string $name): Tag
    {
        $tag->update(['name' => $name, 'slug' => Str::slug($name)]);

        return $tag->fresh();
    }
}
