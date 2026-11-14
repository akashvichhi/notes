<?php

namespace App\Support;

class SnippetBuilder
{
    /**
     * Plain-text snippet centred on the first matching term. Emits no HTML:
     * the client is responsible for highlighting, so nothing we return can
     * become markup.
     */
    public static function build(string $text, array $terms, int $radius = 90): string
    {
        $text = trim(preg_replace('/\s+/u', ' ', strip_tags($text)));

        if ($text === '') {
            return '';
        }

        $at = null;
        foreach ($terms as $term) {
            $pos = mb_stripos($text, $term);
            if ($pos !== false) {
                $at = $pos;
                break;
            }
        }

        if ($at === null) {
            return mb_substr($text, 0, $radius * 2).(mb_strlen($text) > $radius * 2 ? '…' : '');
        }

        $start = max(0, $at - $radius);
        $slice = mb_substr($text, $start, $radius * 2);

        return ($start > 0 ? '…' : '').$slice.($start + $radius * 2 < mb_strlen($text) ? '…' : '');
    }
}
