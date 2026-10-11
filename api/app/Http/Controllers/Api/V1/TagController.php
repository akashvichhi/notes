<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreTagRequest;
use App\Http\Requests\UpdateTagRequest;
use App\Http\Resources\TagResource;
use App\Models\Tag;
use App\Services\Tags\CreateTag;
use App\Services\Tags\DeleteTag;
use App\Services\Tags\RenameTag;

class TagController extends Controller
{
    public function store(StoreTagRequest $request, CreateTag $createTag)
    {
        $tag = $createTag($request->user(), $request->validated('name'));

        return (new TagResource($tag))->response()->setStatusCode(201);
    }

    public function update(UpdateTagRequest $request, Tag $tag, RenameTag $renameTag)
    {
        $this->authorize('update', $tag);

        return new TagResource($renameTag($tag, $request->validated('name')));
    }

    public function destroy(Tag $tag, DeleteTag $deleteTag)
    {
        $this->authorize('delete', $tag);

        $deleteTag($tag);

        return response()->noContent();
    }
}
