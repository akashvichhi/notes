<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreAccessTokenRequest;
use App\Http\Resources\AccessTokenResource;
use App\Queries\AccessTokenQuery;
use App\Services\Auth\CreateAccessToken;
use App\Services\Auth\RevokeAccessToken;
use Illuminate\Http\Request;

/**
 * Personal access tokens, managed by the user in the app. These routes sit
 * behind the `account` ability, so a PAT can never mint or revoke a token.
 */
class AccessTokenController extends Controller
{
    public function index(Request $request, AccessTokenQuery $tokens)
    {
        return AccessTokenResource::collection($tokens->forUser($request->user()));
    }

    public function store(StoreAccessTokenRequest $request, CreateAccessToken $createAccessToken)
    {
        $created = $createAccessToken(
            $request->user(),
            $request->validated('name'),
            $request->validated('abilities'),
            $request->validated('expires_in_days'),
        );

        return response()->json([
            'token' => $created->plainTextToken,
            'access_token' => new AccessTokenResource($created->accessToken),
        ], 201);
    }

    public function destroy(Request $request, int $id, RevokeAccessToken $revokeAccessToken)
    {
        $revokeAccessToken($request->user(), $id);

        return response()->noContent();
    }
}
