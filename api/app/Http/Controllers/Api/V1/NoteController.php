<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\DestroyNoteRequest;
use App\Http\Requests\IndexNotesRequest;
use App\Http\Requests\RestoreNoteRequest;
use App\Http\Requests\StoreNoteRequest;
use App\Http\Requests\SyncNoteTagsRequest;
use App\Http\Requests\UpdateNoteRequest;
use App\Http\Resources\NoteListCollection;
use App\Http\Resources\NoteListResource;
use App\Http\Resources\NoteResource;
use App\Models\Note;
use App\Queries\NotesQuery;
use App\Services\Notes\CreateNote;
use App\Services\Notes\DeleteNote;
use App\Services\Notes\DuplicateNote;
use App\Services\Notes\EmptyTrash;
use App\Services\Notes\RestoreNote;
use App\Services\Notes\SyncNoteTags;
use App\Services\Notes\UpdateNote;
use Illuminate\Http\Request;

class NoteController extends Controller
{
    public function index(IndexNotesRequest $request, NotesQuery $notes)
    {
        return new NoteListCollection(
            $notes->paginate($request->user(), $request->filters()),
        );
    }

    public function store(StoreNoteRequest $request, CreateNote $createNote)
    {
        $note = $createNote($request->user(), $request->validated('folder_id'));

        return (new NoteResource($note))->response()->setStatusCode(201);
    }

    public function show(Note $note)
    {
        $this->authorize('view', $note);

        return new NoteResource($note->load(['folder', 'tags']));
    }

    public function update(UpdateNoteRequest $request, Note $note, UpdateNote $updateNote)
    {
        $this->authorize('update', $note);

        return new NoteResource($updateNote($request->user(), $note, $request->validated()));
    }

    public function destroy(DestroyNoteRequest $request, Note $note, DeleteNote $deleteNote)
    {
        $this->authorize('delete', $note);

        $deleteNote($note, $request->boolean('force'));

        return response()->noContent();
    }

    public function restore(RestoreNoteRequest $request, Note $note, RestoreNote $restoreNote)
    {
        $this->authorize('delete', $note);

        return new NoteResource(
            $restoreNote($request->user(), $note, $request->validated('folder_id')),
        );
    }

    public function emptyTrash(Request $request, EmptyTrash $emptyTrash)
    {
        $emptyTrash($request->user());

        return response()->noContent();
    }

    public function duplicate(Note $note, DuplicateNote $duplicateNote)
    {
        $this->authorize('view', $note);

        return (new NoteResource($duplicateNote($note)))->response()->setStatusCode(201);
    }

    public function syncTags(SyncNoteTagsRequest $request, Note $note, SyncNoteTags $syncTags)
    {
        $this->authorize('update', $note);

        return new NoteResource($syncTags($request->user(), $note, $request->validated('names')));
    }
}
