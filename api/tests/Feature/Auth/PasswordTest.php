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

    public function test_changing_the_password_in_the_browser_revokes_every_token(): void
    {
        $user = User::factory()->create();
        $this->accessToken($user, 'Claude');

        // A browser request is signed in by its session cookie, not a token.
        $this->actingAs($user, 'web')
            ->fromBrowser()
            ->putJson('/api/v1/me/password', [
                'current_password' => 'password',
                'password' => 'a-new-password',
                'password_confirmation' => 'a-new-password',
            ])
            ->assertNoContent();

        $this->assertSame(0, $user->tokens()->count());
    }

    public function test_resetting_the_password_revokes_every_token(): void
    {
        $user = User::factory()->create();
        $this->accessToken($user, 'Leaked token');

        $this->postJson('/api/v1/reset-password', [
            'token' => Password::createToken($user),
            'email' => $user->email,
            'password' => 'a-new-password',
            'password_confirmation' => 'a-new-password',
        ])->assertNoContent();

        $this->assertSame(0, $user->tokens()->count());
    }

    private function accessToken(User $user, string $name): void
    {
        app(CreateAccessToken::class)($user, $name, ['notes:read']);
    }
}
