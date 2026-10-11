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
            'cursor' => ['nullable', 'string'],
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
        ];
    }
}
