<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\IssueTokenRequest;
use App\Http\Requests\LoginRequest;
use App\Http\Requests\RegisterRequest;
use App\Http\Resources\UserResource;
use App\Services\Auth\AuthenticateUser;
use App\Services\Auth\IssueToken;
use App\Services\Auth\LogoutUser;
use App\Services\Auth\RegisterUser;
use App\Services\Auth\RevokeCurrentToken;
use Illuminate\Http\Request;

class AuthController extends Controller
{
    public function register(RegisterRequest $request, RegisterUser $register)
    {
        $user = $register($request->validated(), $request->session());

        return (new UserResource($user))->response()->setStatusCode(201);
    }

    public function login(LoginRequest $request, AuthenticateUser $authenticate)
    {
        return new UserResource($authenticate($request->validated(), $request->session()));
    }

    public function logout(Request $request, LogoutUser $logout)
    {
        $logout($request->session());

        return response()->noContent();
    }

    public function me(Request $request)
    {
        return new UserResource($request->user());
    }

    public function issueToken(IssueTokenRequest $request, IssueToken $issueToken)
    {
        $token = $issueToken($request->validated());

        return response()->json(['token' => $token]);
    }

    public function revokeToken(Request $request, RevokeCurrentToken $revokeCurrentToken)
    {
        $revokeCurrentToken($request->user());

        return response()->noContent();
    }
}

