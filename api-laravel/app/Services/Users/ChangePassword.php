<?php

namespace App\Services\Users;

use App\Models\User;
use Illuminate\Contracts\Session\Session;

class ChangePassword
{
    /**
     * Every other sign-in ends: other browser sessions fail Sanctum's
     * AuthenticateSession password-hash check, and every access token is
     * revoked. Only a browser session can reach this route.
     */
    public function __invoke(User $user, string $password, Session $session): void
    {
        $user->update(['password' => $password]);
        $user->tokens()->delete();
        $session->regenerate();
    }
}
