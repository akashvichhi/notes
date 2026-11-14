<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\SearchRequest;
use App\Services\Search\SearchNotes;

class SearchController extends Controller
{
    public function __invoke(SearchRequest $request, SearchNotes $searchNotes)
    {
        return $searchNotes($request->user(), $request->validated('q'));
    }
}
