<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class SyncNoteTagsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'names' => ['present', 'array', 'max:50'],
            'names.*' => ['string', 'max:60'],
        ];
    }
}
