<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\ForgotPasswordRequest;
use App\Http\Requests\ResetPasswordRequest;
use App\Services\Auth\ResetPassword;
use App\Services\Auth\SendPasswordResetLink;

class PasswordResetController extends Controller
{
    public function forgot(ForgotPasswordRequest $request, SendPasswordResetLink $sendLink)
    {
        $sendLink($request->validated('email'));

        return response()->noContent();
    }

    public function reset(ResetPasswordRequest $request, ResetPassword $resetPassword)
    {
        $resetPassword($request->validated());

        return response()->noContent();
    }
}
