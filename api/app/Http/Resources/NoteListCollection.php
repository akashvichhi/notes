<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\ResourceCollection;

class NoteListCollection extends ResourceCollection
{
    public $collects = NoteListResource::class;

    /**
     * Customize the pagination information for the resource.
     */
    public function paginationInformation(Request $request, array $paginated, array $default): array
    {
        unset($default['links']);

        if (isset($default['meta']['links'])) {
            unset($default['meta']['links']);
        }

        return $default;
    }
}
