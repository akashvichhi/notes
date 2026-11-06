<?php

use Illuminate\Support\Facades\Route;

// Serve the React SPA for the root and any client-side routes
Route::get('/{any?}', function () {
    return response()->file(public_path('index.html'));
})->where('any', '^(?!api|sanctum|mcp).*$'); // Ensures /api, /sanctum and /mcp are not captured
