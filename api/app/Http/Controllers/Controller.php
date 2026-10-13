<?php

namespace App\Http\Controllers;

use Illuminate\Auth\Access\Response;
use Illuminate\Support\Facades\Gate;

abstract class Controller
{
    /**
     * Authorize a given action for the current user.
     *
     * @param  string  $ability
     * @param  mixed  $arguments
     * @return \Illuminate\Auth\Access\Response
     *
     * @throws \Illuminate\Auth\Access\AuthorizationException
     */
    public function authorize(string $ability, mixed $arguments = []): Response
    {
        return Gate::authorize($ability, $arguments);
    }
}
