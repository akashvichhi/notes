<?php

namespace App\Services\Auth;

use App\Models\PersonalAccessToken;

class PruneExpiredAccessTokens
{
    /**
     * Sanctum already refuses an expired token; this only removes the dead rows.
     * Device tokens have no expiry and are never touched.
     *
     * @return int the number of tokens removed
     */
    public function __invoke(): int
    {
        return PersonalAccessToken::query()
            ->ofType(PersonalAccessToken::TYPE_PAT)
            ->whereNotNull('expires_at')
            ->where('expires_at', '<', now())
            ->delete();
    }
}
