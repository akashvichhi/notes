<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreFolderRequest;
use App\Http\Requests\UpdateFolderRequest;
use App\Http\Resources\FolderResource;
use App\Models\Folder;
use App\Services\Folders\CreateFolder;
use App\Services\Folders\DeleteFolder;
use App\Services\Folders\RenameFolder;

class FolderController extends Controller
{
    public function store(StoreFolderRequest $request, CreateFolder $createFolder)
    {
        $folder = $createFolder(
            $request->user(),
            $request->validated('name'),
            $request->parentId(),
            $request->validated('color'),
            $request->validated('uuid'),
        );

        return (new FolderResource($folder))->response()->setStatusCode(201);
    }

    public function update(UpdateFolderRequest $request, Folder $folder, RenameFolder $renameFolder)
    {
        $this->authorize('update', $folder);

        return new FolderResource($renameFolder($folder, $request->validated()));
    }

    public function destroy(Folder $folder, DeleteFolder $deleteFolder)
    {
        $this->authorize('delete', $folder);

        $deleteFolder($folder);

        return response()->noContent();
    }
}
