<?php

namespace App\Http\Requests;

use App\Queries\FolderQuery;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreFolderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => [
                'required', 'string', 'max:120',
                Rule::unique('folders', 'name')
                    ->where('user_id', $this->user()->id)
                    ->where('parent_id', $this->parentId()),
            ],
            'parent_uuid' => ['nullable', 'uuid'],
            'color' => ['nullable', 'string', 'size:7'],
        ];
    }

    public function parentId(): int
    {
        return app(FolderQuery::class)
            ->parentIdForUuid($this->user(), $this->input('parent_uuid'));
    }
}
