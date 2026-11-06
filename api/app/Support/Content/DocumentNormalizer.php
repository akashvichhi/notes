<?php

namespace App\Support\Content;

/**
 * tiptap-php parses HTML without enforcing a schema. This pass makes its output
 * valid for the editor's schema (extensions.ts): inline runs inside block
 * containers get a paragraph, block images are lifted out of paragraphs, list
 * items start with a paragraph, cells are never empty, attrs get the editor's
 * defaults, and `note-image:N` placeholders become the original images again.
 */
class DocumentNormalizer
{
    private const IMAGE_SCHEMES = ['http://', 'https://', 'data:image/'];

    /** @param  string[]  $embeddedImages  data URLs the placeholders refer to (NoteImages::embedded) */
    public function __construct(private readonly array $embeddedImages = []) {}

    public function normalize(array $doc): array
    {
        return ['type' => 'doc', 'content' => $this->blocks($doc['content'] ?? [])];
    }

    /** Any mix of nodes → a list of valid block nodes. */
    private function blocks(array $children): array
    {
        $out = [];
        $inline = [];

        $flush = function () use (&$inline, &$out) {
            if ($inline !== []) {
                array_push($out, ...$this->paragraphs(['type' => 'paragraph', 'content' => $inline]));
                $inline = [];
            }
        };

        foreach ($children as $child) {
            if (! is_array($child) || ! isset($child['type'])) {
                continue;
            }

            if (in_array($child['type'], EditorSchema::INLINE_NODES, true)) {
                $inline[] = $child;

                continue;
            }

            $flush();
            array_push($out, ...$this->block($child));
        }

        $flush();

        return $out;
    }

    /** @return array[] zero or more block nodes */
    private function block(array $node): array
    {
        return match ($node['type']) {
            'paragraph', 'heading' => $this->paragraphs($node),
            'blockquote' => [['type' => 'blockquote', 'content' => $this->blocksOrEmpty($node['content'] ?? [])]],
            'bulletList', 'orderedList', 'taskList' => $this->list($node),
            'codeBlock' => [$this->codeBlock($node)],
            'horizontalRule' => [['type' => 'horizontalRule']],
            'image' => [$this->image($node)],
            'table' => $this->table($node),
            'details' => [$this->details($node)],
            'detailsSummary' => $this->paragraphs(['type' => 'paragraph', 'content' => $node['content'] ?? []]),
            // Misplaced structure (a bare list item, row or cell): keep what is inside it.
            default => $this->blocks($node['content'] ?? []),
        };
    }

    private function blocksOrEmpty(array $children): array
    {
        return $this->blocks($children) ?: [['type' => 'paragraph']];
    }

    /**
     * A paragraph or heading. Block nodes found inside (usually an image, since
     * markdown puts `![](…)` in a paragraph) split it, so this may return several.
     */
    private function paragraphs(array $node): array
    {
        $attrs = [];
        if ($node['type'] === 'heading') {
            $level = (int) ($node['attrs']['level'] ?? 1);
            $attrs['level'] = $level >= 1 && $level <= 6 ? $level : 1;
        }
        $align = $node['attrs']['textAlign'] ?? null;
        if (in_array($align, EditorSchema::ALIGNMENTS, true)) {
            $attrs['textAlign'] = $align;
        }

        $make = function (array $inline) use ($node, $attrs): array {
            $p = ['type' => $node['type']];
            if ($attrs !== []) {
                $p['attrs'] = $attrs;
            }
            $inline = $this->inline($inline);
            if ($inline !== []) {
                $p['content'] = $inline;
            }

            return $p;
        };

        $out = [];
        $run = [];
        $split = false;

        foreach ($node['content'] ?? [] as $child) {
            if (! is_array($child) || ! isset($child['type'])) {
                continue;
            }

            if (in_array($child['type'], EditorSchema::INLINE_NODES, true)) {
                $run[] = $child;

                continue;
            }

            $split = true;
            if ($this->inline($run) !== []) {
                $out[] = $make($run);
            }
            $run = [];
            array_push($out, ...$this->block($child));
        }

        if (! $split || $this->inline($run) !== []) {
            $out[] = $make($run);
        }

        return $out;
    }

    /** Text and hard breaks with clean marks; adjacent text with equal marks merged. */
    private function inline(array $nodes, bool $allowBreaks = true): array
    {
        $out = [];

        foreach ($nodes as $node) {
            if (($node['type'] ?? null) === 'hardBreak') {
                $out[] = $allowBreaks ? ['type' => 'hardBreak'] : ['type' => 'text', 'text' => ' '];

                continue;
            }

            if (($node['type'] ?? null) !== 'text' || ! is_string($node['text'] ?? null) || $node['text'] === '') {
                continue;
            }

            $text = ['type' => 'text', 'text' => $node['text']];
            $marks = $this->marks($node['marks'] ?? []);
            if ($marks !== []) {
                $text['marks'] = $marks;
            }

            $last = array_key_last($out);
            if ($last !== null && $out[$last]['type'] === 'text' && ($out[$last]['marks'] ?? []) == ($text['marks'] ?? [])) {
                $out[$last]['text'] .= $text['text'];
            } else {
                $out[] = $text;
            }
        }

        return $out;
    }

    private function marks(array $marks): array
    {
        $byType = [];

        foreach ($marks as $mark) {
            $type = $mark['type'] ?? null;
            if (! in_array($type, EditorSchema::MARKS, true) || isset($byType[$type])) {
                continue;
            }

            $attrs = $mark['attrs'] ?? [];

            if ($type === 'link') {
                $href = trim((string) ($attrs['href'] ?? ''));
                if ($href === '') {
                    continue;
                }
                $byType[$type] = ['type' => 'link', 'attrs' => [
                    'href' => $href,
                    'target' => $attrs['target'] ?? EditorSchema::LINK_TARGET,
                    'rel' => $attrs['rel'] ?? EditorSchema::LINK_REL,
                    'class' => $attrs['class'] ?? null,
                ]];
            } elseif ($type === 'textStyle') {
                $color = $attrs['color'] ?? null;
                if (! is_string($color) || $color === '') {
                    continue;   // a textStyle without a colour carries nothing
                }
                $byType[$type] = ['type' => 'textStyle', 'attrs' => ['color' => $color]];
            } else {
                $byType[$type] = ['type' => $type];
            }
        }

        // The editor's code mark excludes every other mark.
        if (isset($byType['code'])) {
            return [['type' => 'code']];
        }

        // Canonical order, so equal mark sets compare equal when merging text.
        $ordered = [];
        foreach (EditorSchema::MARKS as $type) {
            if (isset($byType[$type])) {
                $ordered[] = $byType[$type];
            }
        }

        return $ordered;
    }

    private function list(array $node): array
    {
        $type = $node['type'];
        $itemType = EditorSchema::LISTS[$type];
        $items = [];

        foreach ($node['content'] ?? [] as $child) {
            if (! is_array($child) || ! isset($child['type'])) {
                continue;
            }

            if (in_array($child['type'], ['listItem', 'taskItem'], true)) {
                $items[] = $this->listItem($itemType, $child);
            } elseif (isset(EditorSchema::LISTS[$child['type']]) && $items !== []) {
                // A list directly inside a list belongs to the item before it.
                $last = array_key_last($items);
                array_push($items[$last]['content'], ...$this->block($child));
            } else {
                $items[] = $this->listItem($itemType, ['type' => $itemType, 'content' => [$child]]);
            }
        }

        if ($items === []) {
            return [];
        }

        $list = ['type' => $type, 'content' => $items];

        if ($type === 'orderedList') {
            $start = (int) ($node['attrs']['start'] ?? 1);
            $list['attrs'] = ['start' => $start >= 0 ? $start : 1, 'type' => null];
        }

        return [$list];
    }

    private function listItem(string $itemType, array $node): array
    {
        $content = $this->blocks($node['content'] ?? []);

        // listItem and taskItem are "paragraph block*".
        if (($content[0]['type'] ?? null) !== 'paragraph') {
            array_unshift($content, ['type' => 'paragraph']);
        }

        $item = ['type' => $itemType];
        if ($itemType === 'taskItem') {
            $checked = $node['attrs']['checked'] ?? false;
            $item['attrs'] = ['checked' => $checked === true || $checked === 'true' || $checked === 'checked' || $checked === 1];
        }
        $item['content'] = $content;

        return $item;
    }

    private function codeBlock(array $node): array
    {
        $text = $this->textOf($node);
        // commonmark ends every fenced block with a newline the editor never has.
        if (str_ends_with($text, "\n")) {
            $text = substr($text, 0, -1);
        }

        $language = $node['attrs']['language'] ?? null;
        $block = ['type' => 'codeBlock', 'attrs' => [
            'language' => is_string($language) && $language !== '' ? $language : null,
        ]];

        if ($text !== '') {
            $block['content'] = [['type' => 'text', 'text' => $text]];
        }

        return $block;
    }

    private function textOf(array $node): string
    {
        if (($node['type'] ?? null) === 'text') {
            return (string) ($node['text'] ?? '');
        }
        if (($node['type'] ?? null) === 'hardBreak') {
            return "\n";
        }

        $text = '';
        foreach ($node['content'] ?? [] as $child) {
            if (is_array($child)) {
                $text .= $this->textOf($child);
            }
        }

        return $text;
    }

    private function image(array $node): array
    {
        $attrs = $node['attrs'] ?? [];
        $src = trim((string) ($attrs['src'] ?? ''));

        if (($number = NoteImages::placeholderNumber($src)) !== null) {
            if (! isset($this->embeddedImages[$number - 1])) {
                throw new ContentException(
                    "Unknown image placeholder ".NoteImages::placeholder($number).'. Keep the placeholders exactly as get_note returned them.'
                );
            }
            $src = $this->embeddedImages[$number - 1];
        } elseif (! $this->allowedImageSource($src)) {
            throw new ContentException('Images must use an http(s) URL or an existing note-image placeholder.');
        }

        $dimension = fn ($v) => is_numeric($v) ? (int) $v : null;

        return ['type' => 'image', 'attrs' => [
            'src' => $src,
            'alt' => isset($attrs['alt']) && $attrs['alt'] !== '' ? (string) $attrs['alt'] : null,
            'title' => isset($attrs['title']) && $attrs['title'] !== '' ? (string) $attrs['title'] : null,
            'width' => $dimension($attrs['width'] ?? null),
            'height' => $dimension($attrs['height'] ?? null),
        ]];
    }

    private function allowedImageSource(string $src): bool
    {
        foreach (self::IMAGE_SCHEMES as $scheme) {
            if (str_starts_with(strtolower($src), $scheme)) {
                return true;
            }
        }

        return false;
    }

    private function table(array $node): array
    {
        $rows = [];

        foreach ($node['content'] ?? [] as $row) {
            if (! is_array($row)) {
                continue;
            }

            // tiptap-php keeps <thead>/<tbody> transparent, but be safe about stray wrappers.
            $cells = [];
            foreach (($row['type'] ?? null) === 'tableRow' ? ($row['content'] ?? []) : [$row] as $cell) {
                if (! is_array($cell) || ! isset($cell['type'])) {
                    continue;
                }
                $cells[] = $this->cell(in_array($cell['type'], ['tableCell', 'tableHeader'], true) ? $cell : ['type' => 'tableCell', 'content' => [$cell]]);
            }

            if ($cells !== []) {
                $rows[] = $cells;
            }
        }

        if ($rows === []) {
            return [];
        }

        // ProseMirror tables must be rectangular.
        $span = fn (array $cells) => array_sum(array_map(fn ($c) => $c['attrs']['colspan'], $cells));
        $width = max(array_map($span, $rows));

        $content = [];
        foreach ($rows as $cells) {
            $cellType = $cells[0]['type'];
            for ($missing = $width - $span($cells); $missing > 0; $missing--) {
                $cells[] = $this->cell(['type' => $cellType]);
            }
            $content[] = ['type' => 'tableRow', 'content' => $cells];
        }

        return [['type' => 'table', 'content' => $content]];
    }

    private function cell(array $node): array
    {
        $attrs = $node['attrs'] ?? [];
        $colwidth = $attrs['colwidth'] ?? null;

        return [
            'type' => $node['type'],
            'attrs' => [
                'colspan' => max(1, (int) ($attrs['colspan'] ?? 1)),
                'rowspan' => max(1, (int) ($attrs['rowspan'] ?? 1)),
                'colwidth' => is_array($colwidth) ? array_map('intval', $colwidth) : null,
            ],
            'content' => $this->blocksOrEmpty($node['content'] ?? []),
        ];
    }

    private function details(array $node): array
    {
        $summary = [];
        $body = [];

        foreach ($node['content'] ?? [] as $child) {
            if (! is_array($child)) {
                continue;
            }
            if (($child['type'] ?? null) === 'detailsSummary' && $summary === []) {
                $summary = $this->inline($child['content'] ?? [], allowBreaks: false);
            } elseif (($child['type'] ?? null) === 'detailsContent') {
                array_push($body, ...($child['content'] ?? []));
            } else {
                $body[] = $child;
            }
        }

        $summaryNode = ['type' => 'detailsSummary'];
        if ($summary !== []) {
            $summaryNode['content'] = $summary;
        }

        return ['type' => 'details', 'content' => [
            $summaryNode,
            ['type' => 'detailsContent', 'content' => $this->blocksOrEmpty($body)],
        ]];
    }
}
