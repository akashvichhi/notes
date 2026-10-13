<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class UpdateNoteRequest extends FormRequest
{
    /** Bodies larger than this are rejected before they reach MySQL. */
    public const MAX_BODY_BYTES = 2_000_000;
    public const MAX_DEPTH = 100;

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'body' => ['sometimes', 'array'],
            // Required only alongside a body: metadata writes must never conflict.
            'version' => ['required_with:body', 'integer', 'min:1'],
            'title' => ['sometimes', 'string', 'max:255'],
            'folder_id' => ['sometimes', 'nullable', 'uuid'],
            'is_starred' => ['sometimes', 'boolean'],
        ];
    }

    public function after(): array
    {
        return [
            function (Validator $validator) {
                if (! $this->has('body')) {
                    return;
                }

                $encoded = json_encode($this->input('body'));

                if ($encoded === false || strlen($encoded) > self::MAX_BODY_BYTES) {
                    $validator->errors()->add('body', __('This note is too large to save.'));

                    return;
                }

                if (self::depth($this->input('body')) > self::MAX_DEPTH) {
                    $validator->errors()->add('body', __('This note is nested too deeply.'));
                }
            },
        ];
    }

    private static function depth(mixed $node, int $level = 0): int
    {
        if ($level > self::MAX_DEPTH || ! is_array($node)) {
            return $level;
        }

        $max = $level;
        foreach ($node['content'] ?? [] as $child) {
            $max = max($max, self::depth($child, $level + 1));
            if ($max > self::MAX_DEPTH) {
                return $max;
            }
        }

        return $max;
    }

    /** True when this request actually changes the document. */
    public function touchesBody(): bool
    {
        return $this->has('body');
    }
}
