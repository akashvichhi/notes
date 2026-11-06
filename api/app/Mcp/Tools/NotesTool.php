<?php

namespace App\Mcp\Tools;

use App\Exceptions\NoteConflictException;
use App\Http\Requests\UpdateNoteRequest;
use App\Mcp\NotePresenter;
use App\Mcp\ToolFailure;
use App\Models\Folder;
use App\Models\Note;
use App\Models\Tag;
use App\Models\User;
use App\Support\Content\ContentException;
use App\Support\TokenAbilities;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Support\Facades\Gate;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\Server\Tool;

/**
 * Shared plumbing for the notes tools. A tool implements `run()`; its
 * parameters are resolved by the container, with `$request` and `$user`
 * supplied. Everything here goes through the existing Services and policies.
 *
 * Validation and authorization exceptions are turned into tool errors by
 * laravel/mcp itself; the failures it would hide behind "internal server
 * error" are translated here.
 */
abstract class NotesTool extends Tool
{
    /** The token ability this tool needs. Write implies read. */
    protected string $ability = TokenAbilities::READ;

    public function handle(Request $request): Response
    {
        $user = $request->user();

        if (! $user instanceof User) {
            return Response::error('Not signed in.');
        }

        if (! $user->tokenCan($this->ability)) {
            return Response::error("This access token does not have the {$this->ability} scope. Create a token with it under Settings → Access tokens.");
        }

        try {
            return app()->call([$this, 'run'], ['request' => $request, 'user' => $user]);
        } catch (ToolFailure|ContentException $e) {
            return Response::error($e->getMessage());
        } catch (NoteConflictException $e) {
            return Response::error(
                "This note changed since you read it (it is now at version {$e->note->version}). "
                .'Call get_note again and reapply your change to the new content.'
            );
        } catch (ModelNotFoundException $e) {
            return Response::error($this->notFound($e->getModel()));
        }
    }

    protected function presenter(User $user): NotePresenter
    {
        return new NotePresenter($user);
    }

    /**
     * A note the user owns. Trashed notes are invisible to reads; a write that
     * reaches one gets told why it cannot proceed.
     *
     * @throws AuthorizationException
     */
    protected function note(User $user, string $uuid, string $ability = 'view', bool $write = false): Note
    {
        $write = $write || $ability !== 'view';
        $note = Note::withTrashed()->ownedBy($user)->where('uuid', $uuid)->first();

        if (! $note || ($note->trashed() && ! $write)) {
            throw (new ModelNotFoundException)->setModel(Note::class);
        }

        if ($note->trashed()) {
            throw new ToolFailure('This note is in Trash. It can only be restored from the Notes app.');
        }

        Gate::forUser($user)->authorize($ability, $note);

        return $note->load(['folder', 'tags']);
    }

    /** @throws AuthorizationException */
    protected function folder(User $user, string $uuid): Folder
    {
        $folder = Folder::where('user_id', $user->id)->where('uuid', $uuid)->firstOrFail();
        Gate::forUser($user)->authorize('update', $folder);

        return $folder;
    }

    /** @throws AuthorizationException */
    protected function tag(User $user, string $uuid): Tag
    {
        $tag = Tag::where('user_id', $user->id)->where('uuid', $uuid)->firstOrFail();
        Gate::forUser($user)->authorize('update', $tag);

        return $tag;
    }

    /** The same limits PATCH /notes/{note} applies to a body. */
    protected function checkBody(array $body): array
    {
        $encoded = json_encode($body);

        if ($encoded === false || strlen($encoded) > UpdateNoteRequest::MAX_BODY_BYTES) {
            throw new ContentException(__('This note is too large to save.'));
        }

        if (UpdateNoteRequest::depth($body) > UpdateNoteRequest::MAX_DEPTH) {
            throw new ContentException(__('This note is nested too deeply.'));
        }

        return $body;
    }

    /** Tag names as given, trimmed, without blanks. */
    protected function tagNames(array $names): array
    {
        return array_values(array_filter(array_map(fn ($n) => trim((string) $n), $names), fn ($n) => $n !== ''));
    }

    private function notFound(string $model): string
    {
        return match ($model) {
            Note::class => 'No note with that uuid. Use search_notes or list_notes to find it.',
            Folder::class => 'No folder with that id. Use list_folders to see the folders.',
            Tag::class => 'No tag with that id. Use list_tags to see the tags.',
            default => 'Not found.',
        };
    }
}
