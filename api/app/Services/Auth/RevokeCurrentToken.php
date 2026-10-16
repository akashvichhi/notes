<?php

namespace App\Services\Auth;

use App\Models\User;

class RevokeCurrentToken
{
    public function __invoke(User $user): void
    {
        $user->currentAccessToken()?->delete();
    }
}
