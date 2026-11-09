<?php

namespace Tests\Feature\Notes;

use App\Exceptions\NoteConflictException;
use App\Models\Note;
use App\Models\User;
use App\Services\Notes\UpdateNote;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class UpdateNoteTest extends TestCase
{
    use RefreshDatabase;

    private const BODY = ['type' => 'doc', 'content' => [
        ['type' => 'paragraph', 'content' => [['type' => 'text', 'text' => 'Hello']]],
    ]];

    public function test_a_body_write_with_the_current_version_saves_and_bumps_the_version(): void
    {
        $note = Note::factory()->create();
        Sanctum::actingAs($note->user, ['*']);

        $this->patchJson("/api/v1/notes/{$note->uuid}", ['body' => self::BODY, 'version' => 1])
            ->assertOk()
            ->assertJsonPath('data.version', 2);
    }

    public function test_a_body_write_with_a_stale_version_returns_409_with_the_server_copy(): void
    {
        $note = Note::factory()->create(['version' => 3]);
        Sanctum::actingAs($note->user, ['*']);

        $this->patchJson("/api/v1/notes/{$note->uuid}", ['body' => self::BODY, 'version' => 2])
            ->assertStatus(409)
            ->assertJsonPath('server_copy.version', 3);
    }

    public function test_a_body_write_that_loses_a_race_with_another_write_conflicts(): void
    {
        $note = Note::factory()->create();
        // Both requests read version 1; the other one saves first.
        $staleCopy = Note::find($note->id);
        Note::whereKey($note->id)->update(['version' => 2]);

        $this->expectException(NoteConflictException::class);

        app(UpdateNote::class)($note->user, $staleCopy, ['body' => self::BODY, 'version' => 1]);
    }

    public function test_a_body_write_to_a_trashed_note_returns_409(): void
    {
        $note = Note::factory()->create();
        $note->delete();
        Sanctum::actingAs($note->user, ['*']);

        $this->patchJson("/api/v1/notes/{$note->uuid}", ['body' => self::BODY, 'version' => 1])
            ->assertStatus(409)
            ->assertJsonPath('server_copy.uuid', $note->uuid);

        $this->assertSame(1, $note->fresh()->version);
    }

    public function test_a_metadata_write_never_conflicts(): void
    {
        $note = Note::factory()->create(['version' => 5]);
        Sanctum::actingAs($note->user, ['*']);

        $this->patchJson("/api/v1/notes/{$note->uuid}", ['is_starred' => true])
            ->assertOk()
            ->assertJsonPath('data.is_starred', true);
    }

    public function test_another_users_note_cannot_be_changed(): void
    {
        $note = Note::factory()->create();
        Sanctum::actingAs(User::factory()->create(), ['*']);

        $this->patchJson("/api/v1/notes/{$note->uuid}", ['is_starred' => true])->assertForbidden();
    }
}
