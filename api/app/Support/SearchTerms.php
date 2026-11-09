<?php

namespace App\Support;

class SearchTerms
{
    /** MySQL's innodb_ft_min_token_size. Shorter terms can never match. */
    public const MIN_TOKEN = 3;

    /**
     * A name prefix match. `!` is the escape character because MySQL and
     * SQLite disagree on backslash; it keeps `%` and `_` in a query literal.
     */
    public const PREFIX_LIKE = "name LIKE ? ESCAPE '!'";

    private const LIKE_ESCAPE = '!';

    public static function prefixPattern(string $q): string
    {
        return str_replace(
            [self::LIKE_ESCAPE, '%', '_'],
            [self::LIKE_ESCAPE.self::LIKE_ESCAPE, self::LIKE_ESCAPE.'%', self::LIKE_ESCAPE.'_'],
            $q,
        ).'%';
    }

    /** @return string[] */
    public static function parse(string $q): array
    {
        return collect(preg_split('/\s+/u', trim($q)))
            ->filter(fn ($t) => mb_strlen($t) >= self::MIN_TOKEN)
            ->values()
            ->all();
    }

    /** Boolean-mode expression with a trailing wildcard per term. */
    public static function expression(array $terms): string
    {
        return collect($terms)
            ->map(fn ($t) => '+'.addcslashes($t, '+-><()~*:"@').'*')
            ->implode(' ');
    }
}
