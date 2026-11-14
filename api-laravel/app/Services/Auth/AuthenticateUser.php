<?php

namespace App\Services\Auth;

use App\Models\User;
use Illuminate\Contracts\Session\Session;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;

class AuthenticateUser
{
    public function __invoke(array $credentials, Session $session): User
    {
        if (! Auth::attempt($credentials, true)) {
            // Deliberately generic: never reveal whether the email exists.
            throw ValidationException::withMessages(['email' => __('auth.failed')]);
        }

        $session->regenerate();

        return Auth::user();
    }
}
