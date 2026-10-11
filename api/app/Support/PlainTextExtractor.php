<?php

namespace App\Support;

class PlainTextExtractor
{
    public static function extract(?array $doc): string
    {
        if (! $doc) {
            return '';
        }

        $parts = [];
        self::walk($doc, $parts);

        return trim(preg_replace('/\s+/u', ' ', implode(' ', $parts)));
    }

    public static function title(?array $doc): string
    {
        if (! $doc) {
            return '';
        }

        foreach ($doc['content'] ?? [] as $node) {
            if (($node['type'] ?? null) === 'heading') {
                $parts = [];
                self::walk($node, $parts);
                $text = trim(implode(' ', $parts));
                if ($text !== '') {
                    return mb_substr($text, 0, 120);
                }
            }
        }

        foreach ($doc['content'] ?? [] as $node) {
            $parts = [];
            self::walk($node, $parts);
            $text = trim(implode(' ', $parts));
            if ($text !== '') {
                return mb_substr($text, 0, 120);
            }
        }

        return '';
    }

    private static function walk(array $node, array &$parts): void
    {
        if (isset($node['text']) && is_string($node['text'])) {
            $parts[] = $node['text'];
        }

        foreach ($node['content'] ?? [] as $child) {
            if (is_array($child)) {
                self::walk($child, $parts);
            }
        }
    }
}
