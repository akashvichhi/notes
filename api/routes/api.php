<?php

use App\Http\Controllers\Api\V1\AccessTokenController;
use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\BootstrapController;
use App\Http\Controllers\Api\V1\FolderController;
use App\Http\Controllers\Api\V1\NoteController;
use App\Http\Controllers\Api\V1\PasswordResetController;
use App\Http\Controllers\Api\V1\ProfileController;
use App\Http\Controllers\Api\V1\SearchController;
use App\Http\Controllers\Api\V1\TagController;
use App\Models\Note;
use App\Support\TokenAbilities;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::bind('note', fn ($value) => Note::withTrashed()->where('uuid', $value)->firstOrFail());

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware(['auth:sanctum', TokenAbilities::MIDDLEWARE_ACCOUNT]);

Route::prefix('v1')->group(function () {
    Route::get('/health', fn () => ['status' => 'ok']);

    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:5,1');
    Route::post('/tokens', [AuthController::class, 'issueToken'])->middleware('throttle:5,1');
    Route::post('/forgot-password', [PasswordResetController::class, 'forgot'])->middleware('throttle:5,1');
    Route::post('/reset-password', [PasswordResetController::class, 'reset'])->middleware('throttle:5,1');

    // Web sessions (TransientToken) and device tokens (`*`) pass every ability
    // check below. Personal access tokens carry only notes:read / notes:write,
    // so the `account` group — every delete, trash, restore and account route —
    // is unreachable to them.
    Route::middleware('auth:sanctum')->group(function () {
        Route::middleware(TokenAbilities::MIDDLEWARE_READ)->group(function () {
            Route::get('/notes', [NoteController::class, 'index']);
            Route::get('/notes/{note}', [NoteController::class, 'show']);

            Route::get('/search', SearchController::class)->middleware('throttle:60,1');
            Route::get('/bootstrap', BootstrapController::class);
        });

        Route::middleware(TokenAbilities::MIDDLEWARE_WRITE)->group(function () {
            Route::post('/folders', [FolderController::class, 'store']);
            Route::patch('/folders/{folder}', [FolderController::class, 'update']);

            Route::post('/tags', [TagController::class, 'store']);
            Route::patch('/tags/{tag}', [TagController::class, 'update']);

            Route::post('/notes', [NoteController::class, 'store']);
            Route::patch('/notes/{note}', [NoteController::class, 'update'])->middleware('throttle:240,1');
            Route::post('/notes/{note}/duplicate', [NoteController::class, 'duplicate']);
            Route::put('/notes/{note}/tags', [NoteController::class, 'syncTags']);
        });

        Route::middleware(TokenAbilities::MIDDLEWARE_ACCOUNT)->group(function () {
            Route::delete('/tokens/current', [AuthController::class, 'revokeToken']);
            Route::post('/logout', [AuthController::class, 'logout']);
            Route::get('/me', [AuthController::class, 'me']);
            Route::patch('/me', [ProfileController::class, 'update']);
            Route::put('/me/password', [ProfileController::class, 'password']);
            Route::patch('/preferences', [ProfileController::class, 'preferences']);

            // Session or device token only: the `account` ability keeps PATs out.
            Route::get('/me/access-tokens', [AccessTokenController::class, 'index']);
            Route::post('/me/access-tokens', [AccessTokenController::class, 'store'])->middleware('throttle:10,1');
            Route::delete('/me/access-tokens/{id}', [AccessTokenController::class, 'destroy'])->whereNumber('id');

            Route::delete('/folders/{folder}', [FolderController::class, 'destroy']);
            Route::delete('/tags/{tag}', [TagController::class, 'destroy']);

            Route::delete('/notes/{note}', [NoteController::class, 'destroy']);
            Route::post('/notes/{note}/restore', [NoteController::class, 'restore']);
            Route::delete('/trash', [NoteController::class, 'emptyTrash']);
        });
    });
});
