<?php

namespace App\Services\Users;

use App\Models\User;
use Illuminate\Contracts\Session\Session;

class ChangePassword
{
    public function __invoke(User $user, string $password, Session $session): void
    {
        $user->update(['password' => $password]);
        // Keep this session alive while invalidating the others.
        $session->regenerate();
    }
}
