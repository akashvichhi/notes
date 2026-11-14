<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpdatePasswordRequest;
use App\Http\Requests\UpdatePreferencesRequest;
use App\Http\Requests\UpdateProfileRequest;
use App\Http\Resources\UserResource;
use App\Services\Users\ChangePassword;
use App\Services\Users\UpdatePreferences;
use App\Services\Users\UpdateProfile;

class ProfileController extends Controller
{
    public function update(UpdateProfileRequest $request, UpdateProfile $updateProfile)
    {
        return new UserResource($updateProfile($request->user(), $request->validated()));
    }

    public function password(UpdatePasswordRequest $request, ChangePassword $changePassword)
    {
        $changePassword($request->user(), $request->validated('password'), $request->session());

        return response()->noContent();
    }

    public function preferences(UpdatePreferencesRequest $request, UpdatePreferences $updatePreferences)
    {
        return new UserResource($updatePreferences($request->user(), $request->validated()));
    }
}
