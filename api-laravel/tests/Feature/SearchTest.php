<?php

namespace Tests\Feature;

use App\Models\Folder;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SearchTest extends TestCase
{
    use RefreshDatabase;

    public function test_wildcards_in_the_query_match_literally(): void
    {
        $user = User::factory()->create();
        Folder::factory()->for($user)->create(['name' => 'ab x1']);
        Folder::factory()->for($user)->create(['name' => 'a_ x1']);
        Sanctum::actingAs($user, ['*']);

        // Every term is shorter than the full-text minimum, so MATCH is skipped and this runs on SQLite.
        $this->getJson('/api/v1/search?q='.urlencode('a_ x'))
            ->assertOk()
            ->assertJsonPath('folders.*.name', ['a_ x1']);
    }
}
