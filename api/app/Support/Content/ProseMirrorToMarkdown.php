<?php

namespace App\Support\Content;

/**
 * The editor's ProseMirror JSON → markdown, following the plan's mapping table.
 * Formatting markdown cannot express is written as inline HTML that
 * MarkdownToProseMirror parses back. Embedded (data-URL) images become
 * `note-image:N` placeholders.
 *
 * Known limits of the markdown form: table cells hold inline content only
 * (other blocks inside a cell are flattened to text), and colspan, rowspan and
 * column widths are not represented.
 */
class ProseMirrorToMarkdown
{
    private const DELIMITED = ['bold' => '**', 'italic' => '*', 'strike' => '~~'];

    private const HTML_TAGS = [
        'bold' => 'strong', 'italic' => 'em', 'strike' => 's', 'underline' => 'u',
        'highlight' => 'mark', 'subscript' => 'sub', 'superscript' => 'sup',
    ];

    private int $images = 0;

    public static function convert(?array $doc): string
    {
        $content = $doc['content'] ?? [];

        // Trailing empty paragraphs are just the editor's caret room.
        while ($content !== [] && self::isEmptyParagraph(end($content))) {
            array_pop($content);
        }

        return rtrim((new self)->blocks($content));
    }

    private static function isEmptyParagraph(mixed $node): bool
    {
        return is_array($node) && ($node['type'] ?? null) === 'paragraph' && empty($node['content']);
    }

    // ── Blocks ──────────────────────────────────────────────────────────────

    private function blocks(array $nodes): string
    {
        $out = [];
        $previous = null;

        foreach ($nodes as $node) {
            if (! is_array($node) || ! isset($node['type'])) {
                continue;
            }

            // Two adjacent lists of the same kind would merge in markdown; vary the marker.
            $alternate = $previous !== null && $previous === $node['type'] && isset(EditorSchema::LISTS[$node['type']]);
            $rendered = $this->block($node, $alternate);

            if ($rendered !== null) {
                $out[] = $rendered;
                $previous = $alternate ? null : $node['type'];
            }
        }

        return implode("\n\n", $out);
    }

    private function block(array $node, bool $alternate = false): ?string
    {
        $content = $node['content'] ?? [];

        return match ($node['type']) {
            'paragraph' => $this->paragraph($node),
            'heading' => $this->heading($node),
            'blockquote' => $this->prefix($this->blocks($content) ?: '<p></p>', '> ', '> ', '>'),
            'bulletList', 'taskList' => $this->list($node, $alternate ? '*' : '-'),
            'orderedList' => $this->list($node, $alternate ? ')' : '.'),
            'codeBlock' => $this->codeBlock($node),
            'horizontalRule' => '---',
            'image' => $this->image($node['attrs'] ?? []),
            'table' => $this->table($node),
            'details' => $this->details($node),
            default => $content === [] ? null : $this->blocks($content),
        };
    }

    private function paragraph(array $node): string
    {
        $align = $this->alignment($node);

        if ($align !== null) {
            return '<p align="'.$align.'">'.$this->inlineHtml($node['content'] ?? []).'</p>';
        }

        $text = $this->inline($node['content'] ?? []);

        // An empty paragraph is spacing the user typed; markdown has no other way to say it.
        return $text === '' ? '<p></p>' : $text;
    }

    private function heading(array $node): string
    {
        $level = max(1, min(6, (int) ($node['attrs']['level'] ?? 1)));
        $align = $this->alignment($node);

        if ($align !== null) {
            return "<h{$level} align=\"{$align}\">".$this->inlineHtml($node['content'] ?? [])."</h{$level}>";
        }

        return rtrim(str_repeat('#', $level).' '.$this->inline($node['content'] ?? []));
    }

    private function alignment(array $node): ?string
    {
        $align = $node['attrs']['textAlign'] ?? null;

        return in_array($align, EditorSchema::ALIGNMENTS, true) ? $align : null;
    }

    private function list(array $node, string $variant): string
    {
        $items = array_values(array_filter($node['content'] ?? [], 'is_array'));
        $tight = $this->isTight($items);
        $number = (int) ($node['attrs']['start'] ?? 1);
        $out = [];

        foreach ($items as $item) {
            if ($node['type'] === 'orderedList') {
                $marker = $number++.$variant.' ';
                $indent = strlen($marker);
            } elseif ($node['type'] === 'taskList') {
                $marker = $variant.' ['.(($item['attrs']['checked'] ?? false) ? 'x' : ' ').'] ';
                $indent = 2;   // continuation lines align with the text after "- "
            } else {
                $marker = $variant.' ';
                $indent = 2;
            }

            $children = array_values(array_filter($item['content'] ?? [], 'is_array'));
            $body = $tight
                ? implode("\n", array_map(fn ($c) => (string) $this->block($c), $children))
                : $this->blocks($children);

            // An empty first paragraph renders as "<p></p>"; in a list item it is just an empty item.
            if (str_starts_with($body, '<p></p>')) {
                $body = substr($body, strlen('<p></p>'));
            }

            $out[] = rtrim($this->prefix($body, $marker, str_repeat(' ', $indent), ''));
        }

        return implode($tight ? "\n" : "\n\n", $out);
    }

    /** Tight when every item is one paragraph, optionally followed by nested lists. */
    private function isTight(array $items): bool
    {
        foreach ($items as $item) {
            foreach (array_values($item['content'] ?? []) as $i => $child) {
                $type = $child['type'] ?? null;
                if ($i === 0 ? $type !== 'paragraph' : ! isset(EditorSchema::LISTS[$type])) {
                    return false;
                }
            }
        }

        return true;
    }

    private function codeBlock(array $node): string
    {
        $code = '';
        foreach ($node['content'] ?? [] as $child) {
            $code .= is_array($child) ? (string) ($child['text'] ?? '') : '';
        }

        preg_match_all('/`+/', $code, $runs);
        $longest = max(array_map('strlen', $runs[0] ?: ['']));
        $fence = str_repeat('`', max(3, $longest + 1));

        $language = (string) ($node['attrs']['language'] ?? '');
        $language = preg_match('/^[\w+#.-]+$/u', $language) ? $language : '';

        return $fence.$language."\n".($code === '' ? '' : $code."\n").$fence;
    }

    private function image(array $attrs): string
    {
        $src = (string) ($attrs['src'] ?? '');
        if (NoteImages::isEmbedded($src)) {
            $src = NoteImages::placeholder(++$this->images);
        }

        $alt = (string) ($attrs['alt'] ?? '');
        $title = (string) ($attrs['title'] ?? '');

        // Markdown has no size; keep a resized image's size with an <img> tag.
        if (! empty($attrs['width']) || ! empty($attrs['height'])) {
            $html = '<img src="'.$this->attr($src).'"';
            foreach (['alt' => $alt, 'title' => $title, 'width' => $attrs['width'] ?? '', 'height' => $attrs['height'] ?? ''] as $name => $value) {
                if ($value !== '' && $value !== null) {
                    $html .= ' '.$name.'="'.$this->attr((string) $value).'"';
                }
            }

            return $html.'>';
        }

        $md = '!['.$this->escapeText($alt, false, false).']('.$this->url($src);

        return $md.($title !== '' ? ' "'.str_replace('"', '\"', $title).'"' : '').')';
    }

    private function table(array $node): string
    {
        $rows = [];
        foreach ($node['content'] ?? [] as $row) {
            $cells = [];
            foreach ($row['content'] ?? [] as $cell) {
                $cells[] = $this->cell($cell);
                // Keep later columns aligned: a spanned cell becomes empty cells.
                for ($span = (int) ($cell['attrs']['colspan'] ?? 1); $span > 1; $span--) {
                    $cells[] = '';
                }
            }
            $rows[] = $cells;
        }

        if ($rows === []) {
            return '';
        }

        $width = max(1, max(array_map('count', $rows)));
        $line = function (array $cells) use ($width): string {
            $cells = array_pad($cells, $width, '');

            return '| '.implode(' | ', array_map(fn ($c) => $c === '' ? ' ' : $c, $cells)).' |';
        };

        // GFM needs a header row; the first row is it.
        $out = [$line($rows[0]), '|'.str_repeat(' --- |', $width)];
        foreach (array_slice($rows, 1) as $cells) {
            $out[] = $line($cells);
        }

        return implode("\n", $out);
    }

    private function cell(array $cell): string
    {
        $parts = [];

        foreach ($cell['content'] ?? [] as $block) {
            if (($block['type'] ?? null) === 'paragraph' || ($block['type'] ?? null) === 'heading') {
                $parts[] = $this->inline($block['content'] ?? [], table: true);
            } elseif (($block['type'] ?? null) === 'image') {
                $parts[] = $this->image($block['attrs'] ?? []);
            } else {
                // Lists, code and quotes cannot live in a GFM cell: keep their text.
                $parts[] = $this->escapeText(trim(preg_replace('/\s+/u', ' ', $this->plainText($block))), false, true);
            }
        }

        return implode('<br>', array_filter($parts, fn ($p) => $p !== ''));
    }

    private function details(array $node): string
    {
        $summary = '';
        $body = '';

        foreach ($node['content'] ?? [] as $child) {
            if (($child['type'] ?? null) === 'detailsSummary') {
                $summary = $this->inlineHtml($child['content'] ?? []);
            } elseif (($child['type'] ?? null) === 'detailsContent') {
                $body = $this->blocks($child['content'] ?? []);
            }
        }

        // The blank lines end the HTML blocks, so the body is parsed as markdown.
        return "<details>\n<summary>{$summary}</summary>\n\n".($body === '' ? '<p></p>' : $body)."\n\n</details>";
    }

    /** Prefix the first line and every following one (blank lines get `$blank`). */
    private function prefix(string $text, string $first, string $rest, string $blank): string
    {
        $lines = explode("\n", $text);

        foreach ($lines as $i => $line) {
            $lines[$i] = $i === 0 ? $first.$line : ($line === '' ? $blank : $rest.$line);
        }

        return implode("\n", $lines);
    }

    // ── Inline ──────────────────────────────────────────────────────────────

    /** Markdown inline content. Marks open and close like a stack, so runs merge. */
    private function inline(array $nodes, bool $table = false): string
    {
        $out = '';
        $active = [];          // [key => closing string], outermost first
        $pendingSpace = '';    // trailing whitespace held until the marks around it close
        $lineStart = true;

        $closeTo = function (int $keep) use (&$active, &$out) {
            while (count($active) > $keep) {
                $out .= array_pop($active);
            }
        };

        foreach ($nodes as $node) {
            $type = $node['type'] ?? null;

            if ($type === 'hardBreak') {
                $closeTo(0);
                $pendingSpace = '';
                $out .= $table ? '<br>' : "\\\n";
                $lineStart = true;

                continue;
            }

            if ($type === 'image') {
                $closeTo(0);
                $out .= $pendingSpace.$this->image($node['attrs'] ?? []);
                $pendingSpace = '';
                $lineStart = false;

                continue;
            }

            if ($type !== 'text') {
                continue;
            }

            $text = str_replace("\n", ' ', (string) ($node['text'] ?? ''));
            $marks = $this->orderedMarks($node['marks'] ?? []);

            if (trim($text) === '') {
                $pendingSpace .= $text;

                continue;
            }

            if (isset($marks['code'])) {
                $closeTo(0);
                $out .= $pendingSpace.$this->codeSpan($text);
                $pendingSpace = '';
                $lineStart = false;

                continue;
            }

            // Delimiters must hug the text: move edge whitespace outside the marks.
            preg_match('/^(\s*)(.*?)(\s*)$/su', $text, $m);
            [, $lead, $core, $trail] = $m;

            $keys = array_keys($marks);
            $activeKeys = array_keys($active);
            $keep = 0;
            while ($keep < count($activeKeys) && $keep < count($keys) && $activeKeys[$keep] === $keys[$keep]) {
                $keep++;
            }

            $closeTo($keep);
            $out .= $pendingSpace.$lead;
            $pendingSpace = '';

            foreach (array_slice($keys, $keep) as $key) {
                [$open, $close] = $this->markdownDelimiters($marks[$key]);
                $out .= $open;
                $active[$key] = $close;
                $lineStart = false;
            }

            $out .= $this->escapeText($core, $lineStart && $lead === '', $table);
            $pendingSpace = $trail;
            $lineStart = false;
        }

        $closeTo(0);

        // Trailing whitespace at the end of a block is not content.
        return $lineStart && $out === '' ? '' : $out;
    }

    /** HTML inline content, for places markdown is not parsed (aligned blocks, <summary>). */
    private function inlineHtml(array $nodes): string
    {
        $out = '';
        $active = [];

        $closeTo = function (int $keep) use (&$active, &$out) {
            while (count($active) > $keep) {
                $out .= array_pop($active);
            }
        };

        foreach ($nodes as $node) {
            $type = $node['type'] ?? null;

            if ($type === 'hardBreak') {
                $out .= '<br>';

                continue;
            }

            if ($type !== 'text') {
                continue;
            }

            $marks = $this->orderedMarks($node['marks'] ?? []);
            $keys = array_keys($marks);
            $activeKeys = array_keys($active);
            $keep = 0;
            while ($keep < count($activeKeys) && $keep < count($keys) && $activeKeys[$keep] === $keys[$keep]) {
                $keep++;
            }

            $closeTo($keep);
            foreach (array_slice($keys, $keep) as $key) {
                [$open, $close] = $this->htmlTags($marks[$key]);
                $out .= $open;
                $active[$key] = $close;
            }

            $out .= htmlspecialchars(str_replace("\n", ' ', (string) ($node['text'] ?? '')), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        }

        $closeTo(0);

        return $out;
    }

    /** Known marks keyed by type+attrs, in the canonical (outermost-first) order. */
    private function orderedMarks(array $marks): array
    {
        $byType = [];
        foreach ($marks as $mark) {
            $type = $mark['type'] ?? null;
            if (in_array($type, EditorSchema::MARKS, true)) {
                $byType[$type] = $mark;
            }
        }

        $ordered = [];
        foreach (EditorSchema::MARKS as $type) {
            if (! isset($byType[$type])) {
                continue;
            }
            if ($type === 'textStyle' && ! $this->color($byType[$type])) {
                continue;
            }
            $key = $type === 'code' ? 'code' : $type.':'.json_encode($byType[$type]['attrs'] ?? []);
            $ordered[$key] = $byType[$type];
        }

        // The editor's code mark excludes the others.
        foreach ($ordered as $key => $mark) {
            if ($mark['type'] === 'code') {
                return ['code' => $mark];
            }
        }

        return $ordered;
    }

    /** @return array{0: string, 1: string} */
    private function markdownDelimiters(array $mark): array
    {
        $type = $mark['type'];

        if (isset(self::DELIMITED[$type])) {
            return [self::DELIMITED[$type], self::DELIMITED[$type]];
        }

        if ($type === 'link') {
            return ['[', ']('.$this->url((string) ($mark['attrs']['href'] ?? '')).')'];
        }

        return $this->htmlTags($mark);
    }

    /** @return array{0: string, 1: string} */
    private function htmlTags(array $mark): array
    {
        $type = $mark['type'];

        return match (true) {
            $type === 'link' => ['<a href="'.$this->attr((string) ($mark['attrs']['href'] ?? '')).'">', '</a>'],
            $type === 'textStyle' => ['<span style="color:'.$this->attr((string) $this->color($mark)).'">', '</span>'],
            $type === 'code' => ['<code>', '</code>'],
            isset(self::HTML_TAGS[$type]) => ['<'.self::HTML_TAGS[$type].'>', '</'.self::HTML_TAGS[$type].'>'],
            default => ['', ''],
        };
    }

    private function color(array $mark): ?string
    {
        $color = $mark['attrs']['color'] ?? null;

        return is_string($color) && preg_match('/^[#\w(),.%\s-]+$/u', $color) ? trim($color) : null;
    }

    private function codeSpan(string $text): string
    {
        preg_match_all('/`+/', $text, $runs);
        $ticks = str_repeat('`', max(array_map('strlen', $runs[0] ?: [''])) + 1);
        $pad = (str_starts_with($text, '`') || str_ends_with($text, '`')) ? ' ' : '';

        return $ticks.$pad.$text.$pad.$ticks;
    }

    /** Escape text so it reads back as the same characters, not as markdown syntax. */
    private function escapeText(string $text, bool $lineStart, bool $table): string
    {
        $text = preg_replace('/([\\\\`*\[\]~<])/u', '\\\\$1', $text);
        // An underscore between letters can never be emphasis; leave snake_case readable.
        $text = preg_replace('/(?<![\p{L}\p{N}])_|_(?![\p{L}\p{N}])/u', '\\\\_', $text);
        // Entity-like text: "&amp;" typed by the user must stay five characters.
        $text = preg_replace('/&(?=#?\w+;)/u', '\\\\&', $text);

        if ($table) {
            $text = str_replace('|', '\\|', $text);
        }

        if ($lineStart) {
            $text = preg_replace(
                ['/^(\s*)([#>+=-])/u', '/^(\s*\d+)([.)])/u'],
                ['$1\\\\$2', '$1\\\\$2'],
                $text,
            );
        }

        return $text;
    }

    private function url(string $url): string
    {
        return preg_match('/[\s()<>]/u', $url)
            ? '<'.str_replace(['<', '>'], ['%3C', '%3E'], $url).'>'
            : $url;
    }

    private function attr(string $value): string
    {
        return htmlspecialchars($value, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    }

    private function plainText(array $node): string
    {
        if (($node['type'] ?? null) === 'text') {
            return (string) ($node['text'] ?? '');
        }

        $parts = [];
        foreach ($node['content'] ?? [] as $child) {
            if (is_array($child)) {
                $parts[] = $this->plainText($child);
            }
        }

        return implode(' ', $parts);
    }
}
