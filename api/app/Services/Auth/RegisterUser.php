<?php

namespace App\Services\Auth;

use App\Models\User;
use Illuminate\Contracts\Session\Session;
use Illuminate\Support\Facades\Auth;

class RegisterUser
{
    public function __invoke(array $data, Session $session): User
    {
        $user = User::create($data);

        Auth::login($user);
        $session->regenerate();

        return $user;
    }
}
