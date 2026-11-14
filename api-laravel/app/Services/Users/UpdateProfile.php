<?php

namespace App\Services\Users;

use App\Models\User;

class UpdateProfile
{
    public function __invoke(User $user, array $data): User
    {
        $user->update($data);

        return $user->fresh();
    }
}
