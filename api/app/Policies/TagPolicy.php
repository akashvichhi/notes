<?php

namespace App\Policies;

use App\Models\Tag;
use App\Models\User;

class TagPolicy
{
    public function update(User $user, Tag $tag): bool
    {
        return $tag->user_id === $user->id;
    }

    public function delete(User $user, Tag $tag): bool
    {
        return $tag->user_id === $user->id;
    }
}
