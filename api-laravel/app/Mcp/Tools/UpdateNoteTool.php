<?php

namespace App\Mcp\Tools;

use App\Mcp\ToolFailure;
use App\Models\User;
use App\Services\Notes\UpdateNote;
use App\Support\Content\MarkdownToProseMirror;
use App\Support\TokenAbilities;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Tools\Annotations\IsDestructive;
use Laravel\Mcp\Server\Tools\Annotations\IsOpenWorld;

#[Name('update_note')]
#[Description('Change a note\'s title and/or body. Call get_note first and pass its version. mode "replace" (default) swaps the whole body for the markdown; "append" adds the markdown at the end; "prepend" adds it at the start (the rest of the note is untouched). If the note changed since you read it, this fails: call get_note again and reapply your change.')]
#[IsDestructive(false)]
#[IsOpenWorld(false)]
class UpdateNoteTool extends NotesTool
{
    protected string $ability = TokenAbilities::WRITE;

    public function schema(JsonSchema $schema): array
    {
        return [
            'uuid' => $schema->string()->description('The note uuid.')->required(),
            'version' => $schema->integer()->min(1)->description('The version get_note returned.')->required(),
            'title' => $schema->string()->max(255)->description('A new title.'),
            'markdown' => $schema->string()->description('The body markdown. With mode replace, keep every note-image:N placeholder you want to keep.'),
            'mode' => $schema->string()->enum(['replace', 'append', 'prepend'])->description('How markdown is applied. Default replace.'),
        ];
    }

    public function run(Request $request, User $user, UpdateNote $updateNote): Response
    {
        $data = $request->validate([
            'uuid' => ['required', 'uuid'],
            'version' => ['required', 'integer', 'min:1'],
            'title' => ['sometimes', 'string', 'max:255'],
            'markdown' => ['sometimes', 'string'],
            'mode' => ['nullable', 'in:replace,append,prepend'],
        ]);

        if (! array_key_exists('title', $data) && ! array_key_exists('markdown', $data)) {
            throw new ToolFailure('Nothing to change: pass a title, markdown, or both.');
        }

        $note = $this->note($user, $data['uuid'], 'update');
        $changes = array_intersect_key($data, ['title' => true]);

        if (array_key_exists('markdown', $data)) {
            $current = $note->body ?? ['type' => 'doc', 'content' => []];
            // Placeholders in the markdown refer to the images the note has now.
            $added = MarkdownToProseMirror::convert($data['markdown'], $current)['content'];

            // Append and prepend splice documents, so the existing content is never
            // round-tripped through markdown.
            $existing = $this->withoutTrailingEmpty($current['content'] ?? []);
            $content = match ($data['mode'] ?? 'replace') {
                'append' => [...$existing, ...$added],
                'prepend' => [...$added, ...$existing],
                default => $added,
            };

            $changes['body'] = $this->checkBody(['type' => 'doc', 'content' => $content]);
            $changes['version'] = $data['version'];
        }

        $note = $updateNote($user, $note, $changes);

        return Response::json($this->presenter($user)->summary($note) + ['version' => (int) $note->version]);
    }

    private function withoutTrailingEmpty(array $content): array
    {
        while ($content !== [] && (end($content)['type'] ?? null) === 'paragraph' && empty(end($content)['content'])) {
            array_pop($content);
        }

        return $content;
    }
}
