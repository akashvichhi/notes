<?php

namespace Tests\Feature\Auth;

use App\Models\Note;
use App\Support\TokenAbilities;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class TokenAbilitiesTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_read_only_token_can_read_but_not_write(): void
    {
        $note = Note::factory()->create();
        Sanctum::actingAs($note->user, [TokenAbilities::READ]);

        $this->getJson("/api/v1/notes/{$note->uuid}")->assertOk();
        $this->patchJson("/api/v1/notes/{$note->uuid}", ['is_starred' => true])->assertForbidden();
    }

    public function test_a_personal_access_token_never_reaches_account_routes(): void
    {
        $note = Note::factory()->create();
        Sanctum::actingAs($note->user, [TokenAbilities::READ, TokenAbilities::WRITE]);

        $this->deleteJson("/api/v1/notes/{$note->uuid}")->assertForbidden();
        $this->getJson('/api/v1/me/access-tokens')->assertForbidden();
    }
}
