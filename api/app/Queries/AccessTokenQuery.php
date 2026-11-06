<?php

namespace App\Queries;

use App\Models\PersonalAccessToken;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;

/** Personal access tokens only — device sign-in tokens are never listed or touched here. */
class AccessTokenQuery
{
    /** @return Collection<int, PersonalAccessToken> */
    public function forUser(User $user): Collection
    {
        return $this->base($user)->orderByDesc('created_at')->orderByDesc('id')->get();
    }

    public function activeCount(User $user): int
    {
        return $this->base($user)
            ->where(fn (Builder $q) => $q->whereNull('expires_at')->orWhere('expires_at', '>', now()))
            ->count();
    }

    public function findForUser(User $user, int $id): PersonalAccessToken
    {
        return $this->base($user)->whereKey($id)->firstOrFail();
    }

    private function base(User $user): Builder
    {
        return PersonalAccessToken::query()
            ->ofType(PersonalAccessToken::TYPE_PAT)
            ->where('tokenable_type', $user->getMorphClass())
            ->where('tokenable_id', $user->getKey());
    }
}
