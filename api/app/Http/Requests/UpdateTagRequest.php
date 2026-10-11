<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class UpdateTagRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => [
                'required', 'string', 'max:60',
                Rule::unique('tags', 'slug')
                    ->where('user_id', $this->user()->id)
                    ->where('slug', Str::slug((string) $this->input('name')))
                    ->ignore($this->route('tag')->id),
            ],
        ];
    }
}
