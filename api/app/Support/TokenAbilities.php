<?php

namespace App\Support;

/**
 * The one place token abilities are defined.
 *
 * Device sign-in tokens carry `*` and pass every check. Personal access tokens
 * carry only `notes:read` and/or `notes:write`, so they can never reach a route
 * guarded by `account` — deletes, trash, restore, profile, password, tokens.
 */
class TokenAbilities
{
    public const ALL = '*';

    public const READ = 'notes:read';

    public const WRITE = 'notes:write';

    /** Never given to a personal access token. */
    public const ACCOUNT = 'account';

    /** The abilities a personal access token may be created with. */
    public const PAT_ABILITIES = [self::READ, self::WRITE];

    /** Route middleware: write implies read, so either ability may read. */
    public const MIDDLEWARE_READ = 'ability:'.self::READ.','.self::WRITE;

    public const MIDDLEWARE_WRITE = 'ability:'.self::WRITE;

    public const MIDDLEWARE_ACCOUNT = 'ability:'.self::ACCOUNT;

    /**
     * Normalise a requested PAT ability set: keep only known abilities, and add
     * read whenever write is present.
     *
     * @param  string[]  $abilities
     * @return string[]
     */
    public static function forPat(array $abilities): array
    {
        $abilities = array_values(array_intersect(self::PAT_ABILITIES, $abilities));

        if (in_array(self::WRITE, $abilities, true) && ! in_array(self::READ, $abilities, true)) {
            array_unshift($abilities, self::READ);
        }

        return $abilities;
    }
}
