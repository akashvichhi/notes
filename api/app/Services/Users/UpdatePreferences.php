<?php

namespace App\Services\Users;

use App\Models\User;

class UpdatePreferences
{
    public function __invoke(User $user, array $changes): User
    {
        // Merge, so a stale client cannot blank out keys it does not know about.
        $user->update(['preferences' => array_merge($user->preferences ?? [], $changes)]);

        return $user->fresh();
    }
}
