<?php

namespace App\Services\Auth;

use App\Models\PersonalAccessToken;
use App\Models\User;
use App\Queries\AccessTokenQuery;
use App\Support\TokenAbilities;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\NewAccessToken;

class CreateAccessToken
{
    public const MAX_ACTIVE = 20;

    public function __construct(private readonly AccessTokenQuery $tokens) {}

    /**
     * @param  string[]  $abilities  any of notes:read, notes:write — write implies read
     */
    public function __invoke(User $user, string $name, array $abilities, ?int $expiresInDays = null): NewAccessToken
    {
        $abilities = TokenAbilities::forPat($abilities);

        if ($abilities === []) {
            throw ValidationException::withMessages([
                'abilities' => __('Choose at least one scope.'),
            ]);
        }

        if ($this->tokens->activeCount($user) >= self::MAX_ACTIVE) {
            throw ValidationException::withMessages([
                'name' => __('You can have up to :max access tokens. Revoke one to create another.', [
                    'max' => self::MAX_ACTIVE,
                ]),
            ]);
        }

        $plainText = $user->generateTokenString();

        $token = $user->tokens()->create([
            'name' => $name,
            'type' => PersonalAccessToken::TYPE_PAT,
            'token' => hash('sha256', $plainText),
            'abilities' => $abilities,
            'expires_at' => $expiresInDays ? now()->addDays($expiresInDays) : null,
        ]);

        return new NewAccessToken($token, $token->getKey().'|'.$plainText);
    }
}
