<?php

use App\Mcp\Servers\NotesServer;
use App\Support\TokenAbilities;
use Laravel\Mcp\Facades\Mcp;

// Loaded automatically by laravel/mcp. Clients send `Authorization: Bearer <PAT>`.
// Each tool checks notes:read / notes:write itself; this only admits tokens
// that carry at least one notes ability.
Mcp::web('/mcp', NotesServer::class)
    ->middleware(['auth:sanctum', TokenAbilities::MIDDLEWARE_READ, 'throttle:120,1']);
