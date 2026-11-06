<?php

namespace App\Services\Auth;

use App\Models\PersonalAccessToken;
use App\Models\User;
use App\Support\TokenAbilities;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class IssueToken
{
    public function __invoke(array $data): string
    {
        $user = User::where('email', $data['email'])->first();

        if (! $user || ! Hash::check($data['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => __('auth.failed'),
            ]);
        }

        // Same as Sanctum's createToken(), plus the token type, in one insert.
        $plainText = $user->generateTokenString();

        $token = $user->tokens()->create([
            'name' => $data['device_name'],
            'type' => PersonalAccessToken::TYPE_DEVICE,
            'token' => hash('sha256', $plainText),
            'abilities' => [TokenAbilities::ALL],
        ]);

        return $token->getKey().'|'.$plainText;
    }
}
