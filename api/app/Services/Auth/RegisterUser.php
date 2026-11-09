<?php

namespace App\Services\Auth;

use App\Models\User;
use Illuminate\Contracts\Session\Session;
use Illuminate\Support\Facades\Auth;

class RegisterUser
{
    /**
     * A browser gets a session straight away. A native app has no session: it
     * signs in afterwards through POST /tokens.
     */
    public function __invoke(array $data, ?Session $session): User
    {
        $user = User::create($data);

        if ($session !== null) {
            Auth::login($user);
            $session->regenerate();
        }

        return $user;
    }
}
