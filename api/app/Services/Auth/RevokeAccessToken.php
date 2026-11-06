<?php

namespace App\Services\Auth;

use App\Models\User;
use App\Queries\AccessTokenQuery;

class RevokeAccessToken
{
    public function __construct(private readonly AccessTokenQuery $tokens) {}

    /** Another user's token, or a device token, is a 404 — never revoked. */
    public function __invoke(User $user, int $id): void
    {
        $this->tokens->findForUser($user, $id)->delete();
    }
}
