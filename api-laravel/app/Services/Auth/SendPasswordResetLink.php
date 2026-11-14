<?php

namespace App\Services\Auth;

use Illuminate\Support\Facades\Password;

class SendPasswordResetLink
{
    public function __invoke(string $email): void
    {
        // Fire and forget: the caller always responds 204, so the API never
        // reveals whether the address is registered.
        Password::sendResetLink(['email' => $email]);
    }
}
