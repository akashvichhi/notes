<?php

namespace Tests\Feature\Folders;

use App\Models\Folder;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class DeleteFolderTest extends TestCase
{
    use RefreshDatabase;

    public function test_deleting_a_nested_folder_moves_its_children_to_its_parent(): void
    {
        $user = User::factory()->create();
        $work = Folder::factory()->for($user)->create(['name' => 'Work']);
        $clients = Folder::factory()->for($user)->create(['name' => 'Clients', 'parent_id' => $work->id]);
        $acme = Folder::factory()->for($user)->create(['name' => 'Acme', 'parent_id' => $clients->id]);
        Sanctum::actingAs($user, ['*']);

        $this->deleteJson("/api/v1/folders/{$clients->uuid}")->assertNoContent();

        $this->assertSame($work->id, $acme->fresh()->parent_id);
    }

    public function test_a_child_whose_name_is_taken_in_the_parent_is_renamed_not_lost(): void
    {
        $user = User::factory()->create();
        Folder::factory()->for($user)->create(['name' => 'Archive']);
        $old = Folder::factory()->for($user)->create(['name' => 'Old']);
        $child = Folder::factory()->for($user)->create(['name' => 'Archive', 'parent_id' => $old->id]);
        Sanctum::actingAs($user, ['*']);

        $this->deleteJson("/api/v1/folders/{$old->uuid}")->assertNoContent();

        $this->assertSame(Folder::ROOT, $child->fresh()->parent_id);
        $this->assertSame('Archive (2)', $child->fresh()->name);
    }
}
