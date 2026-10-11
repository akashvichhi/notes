<?php
namespace App\Exceptions;

use App\Http\Resources\NoteResource;
use App\Models\Note;
use Exception;
use Illuminate\Http\JsonResponse;

/**
 * Thrown by Services\Notes\UpdateNote when the client's version is stale.
 * Rendering itself is what keeps the 409 branch out of the controller.
 */
class NoteConflictException extends Exception
{
    public function __construct(public readonly Note $note)
    {
        parent::__construct('This note changed somewhere else.');
    }

    public function render(): JsonResponse
    {
        return response()->json([
            'message' => __('This note changed somewhere else.'),
            'server_copy' => new NoteResource($this->note->load(['folder', 'tags'])),
        ], 409);
    }
}
