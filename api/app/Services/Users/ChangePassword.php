<?php

namespace App\Services\Users;

use App\Models\User;
use Illuminate\Contracts\Session\Session;
use Laravel\Sanctum\PersonalAccessToken;

class ChangePassword
{
    /**
     * Every other sign-in ends: other browser sessions fail Sanctum's
     * AuthenticateSession password-hash check, and every token except the one
     * making this request is revoked. A native app sends a bearer token and
     * has no session.
     */
    public function __invoke(User $user, string $password, ?Session $session): void
    {
        $user->update(['password' => $password]);

        // A browser session is given a TransientToken, which has no row to keep.
        $current = $user->currentAccessToken();
        $currentTokenId = $current instanceof PersonalAccessToken ? $current->getKey() : null;
        $user->tokens()
            ->when($currentTokenId !== null, fn ($tokens) => $tokens->whereKeyNot($currentTokenId))
            ->delete();

        $session?->regenerate();
    }
}
