<?php

namespace Tests\Feature\Auth;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

class RegisterTest extends TestCase
{
    use RefreshDatabase;

    public function test_registering_signs_the_new_user_in(): void
    {
        $this->register('ada@example.com')
            ->assertCreated()
            ->assertJsonPath('data.email', 'ada@example.com');

        $this->assertAuthenticated('web');
    }

    public function test_registration_is_rate_limited(): void
    {
        foreach (range(1, 5) as $attempt) {
            $this->register("user{$attempt}@example.com")->assertCreated();
        }

        $this->register('user6@example.com')->assertTooManyRequests();
    }

    /** A browser request, so the API starts a session for it. */
    private function register(string $email): TestResponse
    {
        return $this->fromBrowser()
            ->postJson('/api/v1/register', $this->registration($email));
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
