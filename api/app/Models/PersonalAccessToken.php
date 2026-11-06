<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Laravel\Sanctum\PersonalAccessToken as SanctumPersonalAccessToken;

class PersonalAccessToken extends SanctumPersonalAccessToken
{
    /** A native app's sign-in token: full access, created by POST /tokens. */
    public const TYPE_DEVICE = 'device';

    /** A personal access token the user creates for an integration such as the MCP. */
    public const TYPE_PAT = 'pat';

    protected $fillable = [
        'name',
        'type',
        'token',
        'abilities',
        'expires_at',
    ];

    public function scopeOfType(Builder $q, string $type): Builder
    {
        return $q->where('type', $type);
    }
}
