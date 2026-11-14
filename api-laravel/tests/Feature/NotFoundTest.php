<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class NotFoundTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_missing_note_returns_a_generic_404(): void
    {
        Sanctum::actingAs(User::factory()->create(), ['*']);

        $this->getJson('/api/v1/notes/'.Str::uuid())
            ->assertNotFound()
            ->assertExactJson(['message' => 'Not found.']);
    }

    public function test_a_missing_folder_in_a_note_write_returns_a_generic_404(): void
    {
        Sanctum::actingAs(User::factory()->create(), ['*']);

        $this->postJson('/api/v1/notes', ['folder_id' => (string) Str::uuid()])
            ->assertNotFound()
            ->assertExactJson(['message' => 'Not found.']);
    }
}
