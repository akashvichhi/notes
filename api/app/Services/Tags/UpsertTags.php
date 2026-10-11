<?php

namespace App\Services\Tags;

use App\Models\Tag;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

class UpsertTags
{
    /**
     * Resolve a list of tag names to models, creating the ones that do not
     * exist. This is what lets the tag picker create a tag in the same request
     * that attaches it.
     */
    public function __invoke(User $user, array $names): Collection
    {
        return collect($names)
            ->map(fn (string $name) => trim($name))
            ->filter()
            ->unique(fn (string $name) => Str::slug($name))
            ->map(fn (string $name) => Tag::firstOrCreate(
                ['user_id' => $user->id, 'slug' => Str::slug($name)],
                ['name' => $name],
            ))
            ->values();
    }
}
