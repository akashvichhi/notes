<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class StoreTagRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'uuid' => ['sometimes', 'uuid'],
            'name' => [
                'required', 'string', 'max:60',
                Rule::unique('tags', 'slug')
                    ->where('user_id', $this->user()->id)
                    ->where('slug', Str::slug((string) $this->input('name'))),
            ],
        ];
    }
}
