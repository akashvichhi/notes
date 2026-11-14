<?php

namespace App\Providers;

use App\Models\PersonalAccessToken;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Laravel\Sanctum\Sanctum;

class AppServiceProvider extends ServiceProvider
{
    public const AUTH_ATTEMPTS_PER_MINUTE = 5;

    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Sanctum::usePersonalAccessTokenModel(PersonalAccessToken::class);

        // Keyed by IP, never by user: registering signs the new user in, and a
        // per-user key would hand every new account a fresh allowance.
        RateLimiter::for('auth', fn (Request $request) => Limit::perMinute(self::AUTH_ATTEMPTS_PER_MINUTE)->by($request->ip()));
    }
}
