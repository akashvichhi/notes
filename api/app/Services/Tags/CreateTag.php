<?php

namespace App\Services\Tags;

use App\Models\Tag;
use App\Models\User;
use Illuminate\Support\Str;

class CreateTag
{
    public function __invoke(User $user, string $name, ?string $uuid = null): Tag
    {
        $tag = $user->tags()->make(['name' => $name, 'slug' => Str::slug($name)]);

        if ($uuid) {
            $tag->uuid = $uuid;
        }

        $tag->save();

        return $tag;
    }
}
