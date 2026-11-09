<?php

namespace Tests\Feature\Auth;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RegisterTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_native_app_can_register_without_a_session(): void
    {
        // A Tauri app is not a stateful origin, so the request has no session.
        $this->postJson('/api/v1/register', $this->registration('ada@example.com'))
            ->assertCreated()
            ->assertJsonPath('data.email', 'ada@example.com');
    }

    public function test_registration_is_rate_limited(): void
    {
        foreach (range(1, 5) as $attempt) {
            $this->postJson('/api/v1/register', $this->registration("user{$attempt}@example.com"))->assertCreated();
        }

        $this->postJson('/api/v1/register', $this->registration('user6@example.com'))->assertTooManyRequests();
    }

    /** @return array<string, string> */
    private function registration(string $email): array
    {
        return [
            'name' => 'Ada',
            'email' => $email,
            'password' => 'a-long-password',
            'password_confirmation' => 'a-long-password',
        ];
    }
}
