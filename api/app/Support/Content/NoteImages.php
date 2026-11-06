<?php

namespace App\Support\Content;

/**
 * Pasted images live in the body as base64 data URLs, often megabytes each.
 * Markdown handed to a client carries `note-image:N` placeholders instead;
 * N counts data-URL images in document order, starting at 1.
 */
class NoteImages
{
    public const SCHEME = 'note-image:';

    /** @return string[] the data-URL `src` of every embedded image, in document order */
    public static function embedded(?array $doc): array
    {
        $found = [];
        self::walk($doc ?? [], $found);

        return $found;
    }

    public static function isEmbedded(?string $src): bool
    {
        return is_string($src) && str_starts_with($src, 'data:');
    }

    public static function placeholder(int $number): string
    {
        return self::SCHEME.$number;
    }

    /** The image number in `note-image:N`, or null when `$src` is not a placeholder. */
    public static function placeholderNumber(?string $src): ?int
    {
        if (! is_string($src) || ! preg_match('/^'.preg_quote(self::SCHEME, '/').'(\d+)$/', trim($src), $m)) {
            return null;
        }

        return (int) $m[1];
    }

    private static function walk(array $node, array &$found): void
    {
        if (($node['type'] ?? null) === 'image' && self::isEmbedded($node['attrs']['src'] ?? null)) {
            $found[] = $node['attrs']['src'];
        }

        foreach ($node['content'] ?? [] as $child) {
            if (is_array($child)) {
                self::walk($child, $found);
            }
        }
    }
}
