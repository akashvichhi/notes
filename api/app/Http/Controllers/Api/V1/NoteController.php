<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\IndexNotesRequest;
use App\Http\Requests\StoreNoteRequest;
use App\Http\Resources\NoteListResource;
use App\Http\Resources\NoteResource;
use App\Models\Note;
use App\Queries\NotesQuery;
use App\Services\Notes\CreateNote;

class NoteController extends Controller
{
    public function index(IndexNotesRequest $request, NotesQuery $notes)
    {
        return NoteListResource::collection(
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
}
