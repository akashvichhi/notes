<?php

namespace App\Http\Controllers;

use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\Access\Response;
use Illuminate\Support\Facades\Gate;

abstract class Controller
{
    /**
     * Authorize a given action for the current user.
     *
     *
     * @throws AuthorizationException
     */
    public function authorize(string $ability, mixed $arguments = []): Response
    {
        return Gate::authorize($ability, $arguments);
    }
}
