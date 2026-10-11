<?php

namespace App\Http\Requests;

use App\Models\Folder;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateFolderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => [
                'sometimes', 'string', 'max:120',
                Rule::unique('folders', 'name')
                    ->where('user_id', $this->user()->id)
                    ->where('parent_id', $this->route('folder')->parent_id)
                    ->ignore($this->route('folder')->id),
            ],
            'color' => ['nullable', 'string', 'size:7'],
            'position' => ['sometimes', 'integer'],
        ];
    }
}
