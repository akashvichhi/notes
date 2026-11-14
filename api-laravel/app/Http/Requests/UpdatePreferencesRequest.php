<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdatePreferencesRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'theme' => ['sometimes', 'in:light,dark,system'],
            'sort' => ['sometimes', 'in:updated,created,title'],
            'group_by_date' => ['sometimes', 'boolean'],
            'show_snippets' => ['sometimes', 'boolean'],
        ];
    }
}
