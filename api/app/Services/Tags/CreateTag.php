<?php

namespace App\Services\Tags;

use App\Models\Tag;
use App\Models\User;
use Illuminate\Support\Str;

class CreateTag
{
    public function __invoke(User $user, string $name): Tag
    {
        return $user->tags()->create(['name' => $name, 'slug' => Str::slug($name)]);
    }
}
