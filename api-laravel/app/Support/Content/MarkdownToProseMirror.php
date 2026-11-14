<?php

namespace App\Support\Content;

use DOMDocument;
use DOMElement;
use DOMNode;
use DOMXPath;
use League\CommonMark\Environment\Environment;
use League\CommonMark\Extension\Autolink\AutolinkExtension;
use League\CommonMark\Extension\CommonMark\CommonMarkCoreExtension;
use League\CommonMark\Extension\DisallowedRawHtml\DisallowedRawHtmlExtension;
use League\CommonMark\Extension\Strikethrough\StrikethroughExtension;
use League\CommonMark\Extension\Table\TableExtension;
use League\CommonMark\Extension\TaskList\TaskListExtension;
use League\CommonMark\MarkdownConverter;
use Tiptap\Editor;

/**
 * Markdown (GFM plus the inline-HTML forms in the plan's mapping table) →
 * the editor's ProseMirror JSON. Never sets plain_text: DeriveNoteFields does.
 *
 * markdown → HTML (league/commonmark) → DOM fix-ups → Tiptap JSON
 * (ueberdosis/tiptap-php) → DocumentNormalizer.
 */
class MarkdownToProseMirror
{
    /** Bodies this large are rejected by UpdateNoteRequest anyway; fail early and clearly. */
    public const MAX_MARKDOWN_BYTES = 1_000_000;

    /** Removed with their content: nothing in them can become note content. */
    private const STRIP = ['script', 'style', 'iframe', 'object', 'embed', 'noscript', 'template',
        'form', 'button', 'textarea', 'select', 'link', 'meta', 'title', 'head', 'svg', 'math'];

    /**
     * @param  array|null  $currentDoc  the body the markdown was read from, so
     *                                  `note-image:N` placeholders resolve to its images
     *
     * @throws ContentException
     */
    public static function convert(string $markdown, ?array $currentDoc = null): array
    {
        if (strlen($markdown) > self::MAX_MARKDOWN_BYTES) {
            throw new ContentException('This note is too large to save.');
        }

        $markdown = str_replace(["\r\n", "\r"], "\n", $markdown);

        if (trim($markdown) === '') {
            return ['type' => 'doc', 'content' => []];
        }

        $html = self::prepare(self::converter()->convert($markdown)->getContent());

        $raw = $html === ''
            ? ['type' => 'doc', 'content' => []]
            : (new Editor(['extensions' => EditorSchema::extensions()]))->setContent($html)->getDocument();

        return (new DocumentNormalizer(NoteImages::embedded($currentDoc)))->normalize($raw);
    }

    private static function converter(): MarkdownConverter
    {
        $environment = new Environment([
            // Raw HTML is how the mapping table carries <u>, <mark>, colour, alignment
            // and <details>. Only schema nodes survive tiptap-php, and STRIP runs first.
            'html_input' => 'allow',
            'allow_unsafe_links' => false,
            'max_nesting_level' => 100,
            // A soft line break is a space in the editor, never a newline in a text node.
            'renderer' => ['soft_break' => ' '],
        ]);

        $environment->addExtension(new CommonMarkCoreExtension);
        $environment->addExtension(new TableExtension);
        $environment->addExtension(new StrikethroughExtension);
        $environment->addExtension(new TaskListExtension);
        $environment->addExtension(new AutolinkExtension);
        $environment->addExtension(new DisallowedRawHtmlExtension);

        return new MarkdownConverter($environment);
    }

    /** Rewrite commonmark's HTML into the shapes tiptap-php's parse rules expect. */
    private static function prepare(string $html): string
    {
        $dom = new DOMDocument;
        $previous = libxml_use_internal_errors(true);
        $dom->loadHTML('<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>'.$html.'</body></html>', LIBXML_NONET);
        libxml_clear_errors();
        libxml_use_internal_errors($previous);

        $xpath = new DOMXPath($dom);
        $body = $dom->getElementsByTagName('body')->item(0);

        if (! $body) {
            return '';
        }

        foreach (self::STRIP as $tag) {
            foreach (iterator_to_array($xpath->query('//body//'.$tag)) as $el) {
                $el->parentNode?->removeChild($el);
            }
        }

        self::taskLists($xpath);
        self::alignment($xpath);
        self::details($dom, $xpath);

        // Any checkbox not consumed by a task list is not content.
        foreach (iterator_to_array($xpath->query('//body//input')) as $el) {
            $el->parentNode?->removeChild($el);
        }

        $out = '';
        foreach ($body->childNodes as $child) {
            $out .= $dom->saveHTML($child);
        }

        return trim($out);
    }

    /** `- [ ] x` renders as <li><input type="checkbox"> x</li>; Tiptap wants data-type. */
    private static function taskLists(DOMXPath $xpath): void
    {
        foreach (iterator_to_array($xpath->query('//body//ul')) as $ul) {
            $items = array_filter(iterator_to_array($ul->childNodes), fn (DOMNode $n) => $n instanceof DOMElement && $n->nodeName === 'li');
            $boxes = [];

            foreach ($items as $li) {
                $box = self::leadingCheckbox($li);
                if ($box) {
                    $boxes[spl_object_id($li)] = $box;
                }
            }

            // The editor cannot mix task items and bullet items in one list.
            if ($boxes === []) {
                continue;
            }

            $ul->setAttribute('data-type', 'taskList');

            foreach ($items as $li) {
                $box = $boxes[spl_object_id($li)] ?? null;
                $li->setAttribute('data-type', 'taskItem');
                // tiptap-php keeps the raw attribute string, so only a checked item gets one.
                $li->removeAttribute('checked');
                if ($box && $box->hasAttribute('checked')) {
                    $li->setAttribute('checked', 'checked');
                }

                if ($box) {
                    $next = $box->nextSibling;
                    $box->parentNode->removeChild($box);
                    // Drop the space commonmark leaves after the checkbox.
                    if ($next && $next->nodeType === XML_TEXT_NODE) {
                        $next->nodeValue = ltrim($next->nodeValue);
                    }
                }
            }
        }
    }

    private static function leadingCheckbox(DOMElement $li): ?DOMElement
    {
        $node = $li->firstChild;

        while ($node && $node->nodeType === XML_TEXT_NODE && trim($node->nodeValue) === '') {
            $node = $node->nextSibling;
        }

        // A loose list item wraps its text, checkbox included, in a <p>.
        if ($node instanceof DOMElement && $node->nodeName === 'p') {
            $node = $node->firstChild;
        }

        return $node instanceof DOMElement && $node->nodeName === 'input' && strtolower($node->getAttribute('type')) === 'checkbox'
            ? $node
            : null;
    }

    /** `<p align="center">` → the inline style Tiptap's TextAlign reads. */
    private static function alignment(DOMXPath $xpath): void
    {
        foreach (iterator_to_array($xpath->query('//body//*[@align]')) as $el) {
            $align = strtolower(trim($el->getAttribute('align')));
            $el->removeAttribute('align');

            if (in_array($el->nodeName, ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'], true)
                && in_array($align, EditorSchema::ALIGNMENTS, true)) {
                $el->setAttribute('style', 'text-align: '.$align);
            }
        }
    }

    /** <details><summary>…</summary>…</details> → summary + div[data-type=detailsContent]. */
    private static function details(DOMDocument $dom, DOMXPath $xpath): void
    {
        // Innermost first, so nested details are already in shape when their parent moves them.
        $all = array_reverse(iterator_to_array($xpath->query('//body//details')));

        foreach ($all as $details) {
            $summary = null;
            foreach ($details->childNodes as $child) {
                if ($child instanceof DOMElement && $child->nodeName === 'summary') {
                    $summary = $child;
                    break;
                }
            }

            $content = $dom->createElement('div');
            $content->setAttribute('data-type', 'detailsContent');

            foreach (iterator_to_array($details->childNodes) as $child) {
                if ($child !== $summary) {
                    $content->appendChild($child);
                }
            }

            $summary ??= $dom->createElement('summary');
            $details->appendChild($summary);
            $details->appendChild($content);
        }
    }
}
