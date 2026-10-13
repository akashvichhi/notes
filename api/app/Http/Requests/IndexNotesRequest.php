<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class IndexNotesRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'folder_id' => ['nullable', 'uuid'],
            'tag' => ['nullable', 'string', 'max:60'],
            'starred' => ['nullable', 'boolean'],
            'trashed' => ['nullable', 'boolean'],
            'sort' => ['nullable', 'in:updated,created,title'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ];
    }

    /** The filter set, already coerced, so the query class takes no Request. */
    public function filters(): array
    {
        return [
            'folder_uuid' => $this->input('folder_id'),
            'tag' => $this->input('tag'),
            'starred' => $this->boolean('starred'),
            'trashed' => $this->boolean('trashed'),
            'sort' => $this->input('sort', 'updated'),
            'page' => $this->has('page') ? $this->integer('page', 1) : null,
            'per_page' => $this->has('per_page') ? $this->integer('per_page', 50) : null,
        ];
    }
}
