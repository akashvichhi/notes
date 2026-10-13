<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\Bootstrap\BuildBootstrapPayload;
use Illuminate\Http\Request;

class BootstrapController extends Controller
{
    public function __invoke(Request $request, BuildBootstrapPayload $buildPayload)
    {
        return $buildPayload($request->user());
    }
}
