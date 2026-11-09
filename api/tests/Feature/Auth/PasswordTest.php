<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use App\Services\Auth\CreateAccessToken;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Password;
use Tests\TestCase;

class PasswordTest extends TestCase
{
    use RefreshDatabase;

    public function test_changing_the_password_from_a_native_app_revokes_every_other_token(): void
    {
        $user = User::factory()->create();
        $current = $this->deviceToken($user, 'This laptop');
        $this->deviceToken($user, 'Old phone');
        app(CreateAccessToken::class)($user, 'Claude', ['notes:read']);

        // A bearer-token request from a native app has no session.
        $this->withToken($current)
            ->putJson('/api/v1/me/password', [
                'current_password' => 'password',
                'password' => 'a-new-password',
                'password_confirmation' => 'a-new-password',
            ])
            ->assertNoContent();

        $this->assertSame(['This laptop'], $user->tokens()->pluck('name')->all());
    }

    public function test_resetting_the_password_revokes_every_token(): void
    {
        $user = User::factory()->create();
        $this->deviceToken($user, 'Stolen laptop');

        $this->postJson('/api/v1/reset-password', [
            'token' => Password::createToken($user),
            'email' => $user->email,
            'password' => 'a-new-password',
            'password_confirmation' => 'a-new-password',
        ])->assertNoContent();

        $this->assertSame(0, $user->tokens()->count());
    }

    private function deviceToken(User $user, string $device): string
    {
        return $this->postJson('/api/v1/tokens', [
            'email' => $user->email,
            'password' => 'password',
            'device_name' => $device,
        ])->assertOk()->json('token');
    }
}
